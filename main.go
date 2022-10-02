package main

import (
	"bufio"
	"embed"
	"fmt"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
	"io"
	"io/fs"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/gin-gonic/gin"
)

//go:generate npm install
//go:generate npm run build

//go:embed build
var f embed.FS

var dir = "."

func runCode(c *gin.Context) {
	c.Stream(func(w io.Writer) bool {
		log.Printf("runCode(...)\n")
		// poor man's session id
		sessionid, _ := c.Cookie("sessionid")
		if sessionid == "" {
			sessionid = fmt.Sprintf("%x", rand.Int())
			c.SetCookie("sessionid", sessionid, math.MaxInt, "", "", false, true)
		}
		log.Printf("sessionid=%s\n", sessionid)
		data, err := io.ReadAll(c.Request.Body)
		defer func() { _ = c.Request.Body.Close() }()
		if err != nil {
			c.SSEvent("error", fmt.Errorf("failed to get data: %v", err))
			return false
		}
		for _, line := range strings.Split(string(data), "\n") {
			c.SSEvent("command", line)
		}
		c.Writer.Flush()
		log.Printf("creating docker client...")
		cli, err := client.NewClientWithOpts(client.FromEnv)
		if err != nil {
			c.SSEvent("error", fmt.Errorf("failed to create docker client: %v", err))
			return false
		}
		ctx := c.Request.Context()
		log.Printf("listing containers...")
		containers, err := cli.ContainerList(ctx, types.ContainerListOptions{
			Filters: filters.Args{},
		})
		if err != nil {
			c.SSEvent("error", fmt.Errorf("failed to list containers: %v", err))
			return false
		}
		var containerName string
		for _, c := range containers {
			log.Printf("container=%s\n", c.ID)
			if c.Labels["markdownlayground/sessionid"] == sessionid {
				containerName = c.ID
			}
		}
		if containerName == "" {
			log.Printf("creating container\n")
			resp, err := cli.ContainerCreate(ctx, &container.Config{
				Cmd:   []string{"sleep", "600"},
				Image: "ubuntu",
				Labels: map[string]string{
					"markdownlayground/sessionid": sessionid,
				},
			}, &container.HostConfig{
				AutoRemove: true,
				CapDrop:    []string{"ALL"},
				Resources:  container.Resources{},
			}, &network.NetworkingConfig{}, &v1.Platform{}, sessionid)
			if err != nil {
				c.SSEvent("error", fmt.Errorf("failed to create container: %v", err))
				return false
			}
			containerName = resp.ID
		}
		log.Printf("starting container=%s\n", containerName)

		if err := cli.ContainerStart(ctx, containerName, types.ContainerStartOptions{}); err != nil {
			c.SSEvent("error", fmt.Errorf("failed to start container: %v", err))
			return false
		}
		log.Printf("creating exec...\n")
		exec, err := cli.ContainerExecCreate(ctx, containerName, types.ExecConfig{
			AttachStdin:  true,
			AttachStderr: true,
			AttachStdout: true,
			Tty:          true,
			Cmd:          []string{"sh", "-c", string(data)},
		})
		if err != nil {
			c.SSEvent("error", fmt.Errorf("failed to container exec: %v", err))
			return false
		}
		log.Printf("attaching to exec...\n")
		attach, err := cli.ContainerExecAttach(ctx, exec.ID, types.ExecStartCheck{
			Tty: true,
		})
		if err != nil {
			c.SSEvent("error", fmt.Errorf("failed to attach to container exec: %v", err))
			return false
		}
		defer attach.Close()
		s := bufio.NewScanner(io.MultiReader(attach.Reader))
		for s.Scan() {
			c.SSEvent("output", s.Text())
			c.Writer.Flush()
		}
		if err != nil {
			c.SSEvent("error", fmt.Errorf("failed to scan data: %v", err))
		}
		return false
	})
}

func getFile(c *gin.Context) {
	name := filepath.Join(dir, strings.TrimLeft(filepath.Clean(c.Param("name")), "/"))
	log.Printf("getFile(%q)\n", name)
	data, err := os.ReadFile(name)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, fmt.Errorf("failed to read file: %v", err))
			return
		}
		c.JSON(http.StatusInternalServerError, fmt.Errorf("failed to read file: %v", err))
		return
	}
	c.Data(http.StatusOK, "text/plain", data)
}

func listFiles(c *gin.Context) {
	log.Printf("listFiles\n")
	var docs []gin.H
	err := filepath.Walk(dir, func(path string, info fs.FileInfo, err error) error {
		if len(strings.Split(path, string(os.PathSeparator))) > 2 {
			return filepath.SkipDir
		}
		if filepath.Ext(path) == ".md" {
			title := path
			f, err := os.Open(path)
			if err != nil {
				return err
			}
			defer func() { _ = f.Close() }()

			s := bufio.NewScanner(f)
			if s.Scan() {
				title = strings.TrimPrefix(s.Text(), "# ")
			}

			rel, _ := filepath.Rel(dir, path)
			docs = append(docs, gin.H{
				"path":  rel,
				"title": title,
			})
		}
		return err
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, fmt.Errorf("failed to list files: %v", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"docs": docs,
	})
}

func saveFile(c *gin.Context) {
	name := filepath.Join(dir, strings.TrimLeft(filepath.Clean(c.Param("name")), "/"))
	log.Printf("saveFile(%q)\n", name)
	data, err := io.ReadAll(c.Request.Body)
	defer func() { _ = c.Request.Body.Close() }()
	if err != nil {
		c.JSON(http.StatusBadRequest, fmt.Errorf("failed to read body: %v", err))
		return
	}
	err = os.WriteFile(name, data, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, fmt.Errorf("failed to write file: %v", err))
		return
	}
	c.Status(http.StatusAccepted)
}

func main() {
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}
	log.Printf("dir=%s\n", dir)
	r := gin.Default()
	r.POST("/api/run", runCode)
	r.GET("/api/files", listFiles)
	r.GET("/api/files/*name", getFile)
	r.PUT("/api/files/*name", saveFile)
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		log.Printf("GET %q\n", path)
		c.FileFromFS("build/"+path, http.FS(f))
	})
	err := r.Run()
	if err != nil {
		log.Fatal(err)
	}
}

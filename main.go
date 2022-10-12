package main

import (
	"bufio"
	"embed"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/markdownplayground/markdownplayground/internal/runners"
	"github.com/markdownplayground/markdownplayground/internal/runners/local"

	"github.com/markdownplayground/markdownplayground/internal/runners/docker"

	"github.com/gin-gonic/gin"
)

//go:generate npm install
//go:generate npm run build

//go:embed build
var f embed.FS

var dir = "."

func getConfigFactory(editEnabled bool) func(c *gin.Context) {
	type Config struct {
		EditEnabled bool `json:"editEnabled"`
	}
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, Config{editEnabled})
	}
}
func runCodeFactory(runner runners.Interface) func(c *gin.Context) {
	return func(c *gin.Context) {
		c.Stream(func(w io.Writer) bool {
			log.Printf("runCode(...)\n")
			// poor man's session id
			sessionID := getSessionID(c)
			data, err := io.ReadAll(c.Request.Body)
			defer func() { _ = c.Request.Body.Close() }()
			if err != nil {
				c.SSEvent("error", fmt.Sprintf("failed to get data: %v", err))
				return false
			}
			for i, line := range strings.Split(string(data), "\n") {
				if i == 0 {
					c.SSEvent("command", fmt.Sprintf("$ %s", line))
				} else {
					c.SSEvent("command", line)
				}
			}
			c.Writer.Flush()
			log.Printf("creating runner...")
			attach, err := runner.Run(c.Request.Context(), sessionID, string(data))
			if err != nil {
				c.SSEvent("error", fmt.Sprintf("failed to attach to container exec: %v", err))
				return false
			}
			defer func() { _ = attach.Close() }()
			s := bufio.NewScanner(attach.Reader)
			for s.Scan() {
				c.SSEvent("output", s.Text())
				c.Writer.Flush()
			}
			if err != nil {
				c.SSEvent("error", fmt.Sprintf("failed to scan data: %v", err))
			}
			return false
		})
	}
}

func getSessionID(c *gin.Context) string {
	v, _ := c.Cookie("session-id")
	if v == "" {
		v = fmt.Sprintf("%x", rand.Int())
	}
	c.SetCookie("session-id", v, math.MaxInt, "", "", false, true)
	log.Printf("sessionID=%s\n", v)
	return v
}

func resetExecutorFactory(runner runners.Interface) func(c *gin.Context) {
	return func(c *gin.Context) {
		sessionID := getSessionID(c)
		err := runner.Reset(c.Request.Context(), sessionID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, fmt.Sprintf("failed to reset terminal: %v", err))
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func getFile(c *gin.Context) {
	name := filepath.Join(dir, strings.TrimLeft(filepath.Clean(c.Param("name")), "/"))
	log.Printf("getFile(%q)\n", name)
	data, err := os.ReadFile(name)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, fmt.Sprintf("failed to read file: %v", err))
			return
		}
		c.JSON(http.StatusInternalServerError, fmt.Sprintf("failed to read file: %v", err))
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
		c.JSON(http.StatusInternalServerError, fmt.Sprintf("failed to list files: %v", err))
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
		c.JSON(http.StatusBadRequest, fmt.Sprintf("failed to read body: %v", err))
		return
	}
	err = os.WriteFile(name, data, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, fmt.Sprintf("failed to write file: %v", err))
		return
	}
	c.Status(http.StatusAccepted)
}

func main() {
	editEnabled := flag.Bool("e", false, "enable editing")
	runnerName := flag.String("r", "docker", "[docker|local]")
	flag.Parse()
	log.Printf("dir=%s, runner=%s, editEnabled=%v\n", dir, *runnerName, *editEnabled)
	var runner runners.Interface
	if *runnerName == "local" {
		runner = local.New(dir)
	} else {
		runner = docker.New()
	}
	r := gin.Default()
	r.GET("/api/config", getConfigFactory(*editEnabled))
	r.POST("/api/terminal/run", runCodeFactory(runner))
	r.POST("/api/terminal/reset", resetExecutorFactory(runner))
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

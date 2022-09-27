package main

import (
	"bufio"
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:generate npm install
//go:generate npm run build

//go:embed build
var f embed.FS

func runCode(c *gin.Context) {
	c.Stream(func(w io.Writer) bool {
		log.Printf("runCode(...)\n")
		data, err := io.ReadAll(c.Request.Body)
		defer func() { _ = c.Request.Body.Close() }()
		if err != nil {
			c.SSEvent("error", err.Error())
			return false
		}
		for _, line := range strings.Split(string(data), "\n") {
			c.SSEvent("command", line)
		}
		cmd := exec.Command("sh", "-c", string(data))
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			c.SSEvent("error", err.Error())
			return false
		}
		stderr, err := cmd.StderrPipe()
		if err != nil {
			c.SSEvent("error", err.Error())
			return false
		}
		err = cmd.Start()
		if err != nil {
			c.SSEvent("error", err.Error())
			return false
		}
		s := bufio.NewScanner(io.MultiReader(stdout, stderr))
		for s.Scan() {
			c.SSEvent("output", s.Text())
		}
		err = cmd.Wait()
		if err != nil {
			c.SSEvent("error", err.Error())
		}
		return false
	})
}

func getFile(c *gin.Context) {
	name := strings.TrimLeft(filepath.Clean(c.Param("name")), "/")
	log.Printf("getFile(%q)\n", name)
	data, err := os.ReadFile(name)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, err.Error())
			return
		}
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}
	c.Data(http.StatusOK, "text/plain", data)
}

func listDocs(c *gin.Context) {
	log.Printf("listDocs\n")
	var docs []gin.H
	err := filepath.Walk(".", func(path string, info fs.FileInfo, err error) error {
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

			docs = append(docs, gin.H{
				"path":  path,
				"title": title,
			})
		}
		return err
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"docs": docs,
	})
}

func saveFile(c *gin.Context) {
	name := strings.TrimLeft(filepath.Clean(c.Param("name")), "/")
	log.Printf("saveFile(%q)\n", name)
	data, err := io.ReadAll(c.Request.Body)
	defer func() { _ = c.Request.Body.Close() }()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	err = os.WriteFile(name, data, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}
	c.Status(http.StatusAccepted)
}

func main() {
	r := gin.Default()
	r.POST("/api/run", runCode)
	r.GET("/api/files", listDocs)
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

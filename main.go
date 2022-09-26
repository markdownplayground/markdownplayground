package main

import (
	"bufio"
	"github.com/gin-gonic/gin"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)
import "embed"

//go:generate npm install
//go:generate npm run build

//go:embed build
var f embed.FS

func main() {
	r := gin.Default()
	r.GET("/api/docs", func(c *gin.Context) {
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
	})
	r.GET("/docs/*name", func(c *gin.Context) {
		name := strings.TrimLeft(c.Param("name"), "/")
		log.Printf("getDoc(%q)\n", name)
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
	})
	r.PUT("/docs/*name", func(c *gin.Context) {
		name := strings.TrimLeft(c.Param("name"), "/")
		log.Printf("putDoc(%q)\n", name)
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
	})
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

package files

import (
	"bufio"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

type Files string

func (dir Files) GetFile(c *gin.Context) {
	name := filepath.Join(string(dir), strings.TrimLeft(filepath.Clean(c.Param("name")), "/"))
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

func (dir Files) ListFiles(c *gin.Context) {
	log.Printf("listFiles\n")
	var docs []gin.H
	err := filepath.Walk(string(dir), func(path string, info fs.FileInfo, err error) error {
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

			rel, _ := filepath.Rel(string(dir), path)
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

func (dir Files) SaveFile(c *gin.Context) {
	name := filepath.Join(string(dir), strings.TrimLeft(filepath.Clean(c.Param("name")), "/"))
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

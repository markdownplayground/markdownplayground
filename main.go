package main

import (
	"embed"
	"flag"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/markdownplayground/markdownplayground/internal/api/config"
	"github.com/markdownplayground/markdownplayground/internal/api/files"
	"github.com/markdownplayground/markdownplayground/internal/api/term"
	"github.com/markdownplayground/markdownplayground/internal/api/term/runners"
	"github.com/markdownplayground/markdownplayground/internal/api/term/runners/docker"
	"github.com/markdownplayground/markdownplayground/internal/api/term/runners/k8s"
	"github.com/markdownplayground/markdownplayground/internal/api/term/runners/local"
	"github.com/pkg/browser"
)

//go:generate npm install
//go:generate npm run build

//go:embed build
var fs embed.FS

func main() {
	var editEnabled bool
	var runnerName string
	var openBrowser bool
	flag.BoolVar(&editEnabled, "e", false, "enable editing")
	flag.StringVar(&runnerName, "r", "docker", "[docker|local|k8s]")
	flag.BoolVar(&openBrowser, "b", false, "open browser")
	flag.Parse()
	dir := "."
	if args := flag.Args(); len(args) > 0 {
		dir = args[0]
	}
	log.Printf("dir=%s, runner=%s, editEnabled=%v, openBrowser=%v\n", dir, runnerName, editEnabled, openBrowser)

	r := gin.Default()

	c := config.Config{EditEnabled: editEnabled}
	r.GET("/api/config", c.GetConfig)

	runner, err := newRunner(runnerName, dir)
	if err != nil {
		log.Fatal(err)
	}
	t := term.New(runner)
	r.POST("/api/terminal/run", t.RunCode)
	r.POST("/api/terminal/reset", t.Reset)

	f := files.Files(dir)
	r.GET("/api/files", f.ListFiles)
	r.GET("/api/files/*name", f.GetFile)
	if editEnabled {
		r.PUT("/api/files/*name", f.SaveFile)
	} else {
		r.PUT("/api/files/*name", func(c *gin.Context) {
			c.Status(http.StatusForbidden)
		})
	}
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		log.Printf("GET %q\n", path)
		c.FileFromFS("build/"+path, http.FS(fs))
	})
	go func() {
		time.Sleep(time.Second)
		if err := browser.OpenURL("http://localhost:8080"); err != nil {
			log.Fatal(err)
		}
	}()
	if err := r.Run("localhost:8080"); err != nil {
		log.Fatal(err)
	}
}

func newRunner(runnerName string, dir string) (runners.Interface, error) {
	switch runnerName {
	case "local":
		return local.New(dir), nil
	case "k8s":
		return k8s.New()
	default:
		return docker.New(), nil
	}
}

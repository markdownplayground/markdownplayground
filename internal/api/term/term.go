package term

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/markdownplayground/markdownplayground/internal/api/term/runners"
)

type Term struct{ runner runners.Interface }

func New(runner runners.Interface) Term {
	return Term{runner}
}

func (t Term) RunCode(c *gin.Context) {
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
		attach, err := t.runner.Run(c.Request.Context(), sessionID, string(data))
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

func getSessionID(c *gin.Context) string {
	v, _ := c.Cookie("session-id")
	if v == "" {
		v = fmt.Sprintf("%x", rand.Int())
	}
	c.SetCookie("session-id", v, math.MaxInt, "", "", false, true)
	log.Printf("sessionID=%s\n", v)
	return v
}

func (t Term) Reset(c *gin.Context) {
	sessionID := getSessionID(c)
	err := t.runner.Reset(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, fmt.Sprintf("failed to reset terminal: %v", err))
		return
	}
	c.Status(http.StatusNoContent)
}

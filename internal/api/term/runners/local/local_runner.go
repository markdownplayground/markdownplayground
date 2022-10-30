package local

import (
	"context"
	"fmt"
	"io"
	"os/exec"

	"github.com/markdownplayground/markdownplayground/internal/api/term/runners"
)

type runner struct {
	dir string
}

func (r *runner) Reset(ctx context.Context, session runners.Session) error {
	return fmt.Errorf("not supported")
}

func (r *runner) Run(ctx context.Context, session runners.Session, code string) (*runners.RunResult, error) {
	cmd := exec.Command("sh", "-c", code)
	cmd.Dir = r.dir
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	err = cmd.Start()
	if err != nil {
		return nil, err
	}
	return &runners.RunResult{
		Closer: &closer{cmd},
		Reader: io.MultiReader(stdout, stderr),
	}, nil
}

type closer struct{ *exec.Cmd }

func (c *closer) Close() error {
	return c.Wait()
}

func New(dir string) runners.Interface {
	return &runner{dir}
}

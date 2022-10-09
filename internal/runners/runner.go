package runners

import (
	"context"
	"io"
)

type RunResult struct {
	io.Closer
	Reader io.Reader
}

type Interface interface {
	Run(ctx context.Context, sessionid, code string) (*RunResult, error)
}

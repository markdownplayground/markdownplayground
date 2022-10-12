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
	Run(ctx context.Context, sessionID, code string) (*RunResult, error)
	Reset(ctx context.Context, sessionID string) error
}

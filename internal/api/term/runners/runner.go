package runners

import (
	"context"
	"io"
)

type Session = string

type RunResult struct {
	io.Closer
	Reader io.Reader
}

type Interface interface {
	Run(ctx context.Context, session Session, code string) (*RunResult, error)
	Reset(ctx context.Context, session Session) error
}

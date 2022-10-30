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
	// Run a single script. If the runner has not started, start it up.
	Run(ctx context.Context, session Session, code string) (*RunResult, error)
	// Reset factory reset runner..
	Reset(ctx context.Context, session Session) error
}

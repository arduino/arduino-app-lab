package board

import (
	"context"
	"fmt"
	"io"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

var ErrNoConn = fmt.Errorf("no board connection available")

type noopConnection struct{}

func NoopConn() remote.RemoteConn {
	return &noopConnection{}
}

var _ remote.RemoteConn = (*noopConnection)(nil)

func (c *noopConnection) List(string) ([]remote.FileInfo, error) {
	return nil, ErrNoConn
}

func (c *noopConnection) MkDirAll(string) error {
	return ErrNoConn
}

func (c *noopConnection) WriteFile(io.Reader, string) error {
	return ErrNoConn
}

func (c *noopConnection) ReadFile(string) (io.ReadCloser, error) {
	return nil, ErrNoConn
}

func (c *noopConnection) Remove(string) error {
	return ErrNoConn
}

func (c *noopConnection) Stats(string) (remote.FileInfo, error) {
	return remote.FileInfo{}, ErrNoConn
}

type noCmder struct{}

var _ remote.Cmder = (*noCmder)(nil)

func (c *noCmder) Run(context.Context) error {
	return ErrNoConn
}

func (c *noCmder) Output(context.Context) ([]byte, error) {
	return nil, ErrNoConn
}

func (c *noCmder) Interactive() (io.WriteCloser, io.Reader, io.Reader, remote.Closer, error) {
	return nil, nil, nil, nil, ErrNoConn
}

func (c *noopConnection) GetCmd(string, ...string) remote.Cmder {
	return &noCmder{}
}

func (c *noopConnection) Forward(context.Context, int, int) error {
	return ErrNoConn
}

func (c *noopConnection) ForwardKillAll(context.Context) error {
	return ErrNoConn
}

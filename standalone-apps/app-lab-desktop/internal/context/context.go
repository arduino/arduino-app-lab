package context

import (
	"context"
)

type Holder struct {
	ctx context.Context
}

func NewHolder() *Holder {
	h := &Holder{}
	h.ctx = context.Background()
	return h
}

func (h *Holder) Get() context.Context {
	return h.ctx
}

func (h *Holder) Set(ctx context.Context) {
	h.ctx = ctx
}

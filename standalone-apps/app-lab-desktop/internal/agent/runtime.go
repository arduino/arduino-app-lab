package agent

import "errors"

// RuntimeLocator resolves the command that launches the ACP adapter — the pinned
// node + adapter entry the runtime manager installs, never npx/PATH.
type RuntimeLocator interface {
	Command() (path string, args []string, err error)
}

// StaticLocator is a placeholder: the caller sets the adapter paths explicitly.
type StaticLocator struct {
	NodePath     string
	AdapterEntry string
	ExtraArgs    []string
}

func (l StaticLocator) Command() (string, []string, error) {
	if l.NodePath == "" || l.AdapterEntry == "" {
		return "", nil, errors.New("ai runtime not installed")
	}
	return l.NodePath, append([]string{l.AdapterEntry}, l.ExtraArgs...), nil
}

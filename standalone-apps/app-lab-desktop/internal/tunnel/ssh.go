package tunnel

type SSHErrorAuthFailed struct {
	IsErr   bool   `json:"isSSHErrorAuthFailed"`
	Message string `json:"message"`
}

var _ error = (*SSHErrorAuthFailed)(nil)

func (e SSHErrorAuthFailed) Error() string {
	return e.Message
}

func NewSSHErrorAuthFailed(err error) SSHErrorAuthFailed {
	return SSHErrorAuthFailed{
		IsErr:   true,
		Message: err.Error(),
	}
}

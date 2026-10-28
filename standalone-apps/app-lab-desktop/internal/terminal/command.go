package terminal

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

// ValidateCommand checks that the given terminal command can be used to launch a
// terminal, it returns an error if the executable can not be found.
//
// The command is a command line: the first field is the terminal and the other
// fields are its arguments.
func ValidateCommand(command string) error {
	fields, err := splitCommand(command)
	if err != nil {
		return err
	}
	if len(fields) == 0 {
		return errors.New("empty terminal command")
	}
	if err := validateCommandLine(command); err != nil {
		return err
	}
	if _, err := exec.LookPath(fields[0]); err != nil {
		return fmt.Errorf("terminal not found: %s", fields[0])
	}
	return nil
}

// validateCommandLine checks that the given command line can be given to a
// terminal.
//
// A line break would split the command in two, when it is written in a script
// or in a command line. The characters that the command line of the terminal
// would interpret are rejected too, on the platforms where the command line
// is parsed by a shell.
func validateCommandLine(command string) error {
	if strings.ContainsAny(command, "\r\n") {
		return errors.New("the terminal command contains a line break")
	}
	return validateCustomCommand(command)
}

// splitCommand splits a command line in its arguments, single and double quotes
// are supported.
func splitCommand(command string) ([]string, error) {
	fields := []string{}
	var current strings.Builder
	var quote rune
	hasCurrent := false

	for _, char := range command {
		switch {
		case quote != 0:
			if char == quote {
				quote = 0
			} else {
				current.WriteRune(char)
			}
		case char == '\'' || char == '"':
			quote = char
			hasCurrent = true
		case char == ' ' || char == '\t':
			if hasCurrent || current.Len() > 0 {
				fields = append(fields, current.String())
				current.Reset()
				hasCurrent = false
			}
		default:
			current.WriteRune(char)
			hasCurrent = true
		}
	}
	if quote != 0 {
		return nil, fmt.Errorf("unterminated quote in the terminal command: %s", command)
	}
	if hasCurrent || current.Len() > 0 {
		fields = append(fields, current.String())
	}
	return fields, nil
}

// shellQuoteAll quotes the given arguments so they can be used in a shell command.
func shellQuoteAll(args []string) string {
	quoted := make([]string, 0, len(args))
	for _, arg := range args {
		quoted = append(quoted, shellQuote(arg))
	}
	return strings.Join(quoted, " ")
}

// shellQuote quotes a single argument so it can be used in a shell command.
func shellQuote(arg string) string {
	if arg == "" {
		return "''"
	}
	if !strings.ContainsAny(arg, " \t\n\"'\\$`&|;<>()*?[]{}#~!") {
		return arg
	}
	return "'" + strings.ReplaceAll(arg, "'", `'\''`) + "'"
}

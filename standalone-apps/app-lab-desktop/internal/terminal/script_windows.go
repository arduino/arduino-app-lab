//go:build windows

package terminal

import (
	"fmt"
	"strings"
)

// scriptName is the name of the wrapper script.
const scriptName = "run.cmd"

// scriptContent returns the batch file that runs the given command and keeps
// the terminal open until the user presses a key.
//
// The deletion of the script is the last statement of the file: cmd.exe reads
// a batch file one line at a time and it opens the file again by name, so a
// statement after the deletion of the file would not be executed. The
// temporary directory is removed later, with the cleanup of the stale scripts.
func scriptContent(command []string) (string, error) {
	quoted, err := quoteWindowsArgs(command)
	if err != nil {
		return "", err
	}
	return strings.Join([]string{
		"@echo off",
		quoted,
		"echo Press Enter to close...",
		"pause >nul",
		`del "%~f0" 2>nul`,
		"",
	}, "\r\n"), nil
}

// quoteWindowsArgs quotes the given arguments so they can be used in a batch
// file.
func quoteWindowsArgs(args []string) (string, error) {
	quoted := make([]string, 0, len(args))
	for _, arg := range args {
		quotedArg, err := quoteWindowsArg(arg)
		if err != nil {
			return "", err
		}
		quoted = append(quoted, quotedArg)
	}
	return strings.Join(quoted, " "), nil
}

// quoteWindowsArg quotes a single argument so it can be used in a batch file.
//
// Two rules of the batch line parser apply (Jan Erik and Dave Benham, "The
// Batch Line Parser", Stack Overflow 4095133):
//
//   - The percent expansion is the first phase, before the quoting phase, so a
//     percent sign is expanded even inside a quoted string and the quote does
//     not protect it: it has to be doubled ("%%" becomes "%").
//   - Inside a double-quoted string only '"' and the end of the line are
//     special, so the other command characters ("&", "|", "<", ">", "^", ...)
//     need no escaping. A quote can not be escaped either: it has to be
//     doubled, so that the quotes stay balanced and the program that receives
//     the command line sees the literal quote.
//
// A line break can not be represented in a batch file at all: the parser reads
// the file one line at a time and a carriage return is silently dropped, so an
// argument that contains one is rejected.
func quoteWindowsArg(arg string) (string, error) {
	if strings.ContainsAny(arg, "\r\n") {
		return "", fmt.Errorf("the argument contains a line break: %q", arg)
	}
	escaped := strings.ReplaceAll(arg, "%", "%%")
	escaped = strings.ReplaceAll(escaped, `"`, `""`)
	return `"` + escaped + `"`, nil
}

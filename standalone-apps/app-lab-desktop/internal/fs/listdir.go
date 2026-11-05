package fs

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"strings"
	"syscall"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

// maxConcurrentBoardReads bounds the board reads in flight — the listings and
// the single-path stats alike, since both spend a session.
//
// The ceiling is MaxSessions — SSH *channels* on one connection — not
// MaxStartups: the transport dials once in ssh.FromHost and every operation is a
// client.NewSession() channel on that connection, so a refusal arrives as
// "ssh: rejected: connect failed (open failed)".
//
// An expansion costs one channel now that ListDirectory calls conn.List; a
// WalkFilePaths listing still costs two, Open->Stats then ReadDir->List.
// Measured against a container carrying the board's MaxSessions 10, an app with
// 8 folders, 30 rounds each: the walk at its previous per-call cap of 8 came
// back short of `find` on 14-16 rounds of 30 with the connection idle, and 30 of
// 30 with 5 sessions held. Cap 4 alone closes the idle case but not the loaded
// one (29 of 30); cap 4 with the retry below closes both. Something holds 1-3
// sessions before an app is even open — the watcher's inotifywait, and the nmcli
// status polls the frontend refetches every 3s — so the loaded case is the real
// one, and the retry is what makes this independent of whatever MaxSessions a
// given board image ships.
const maxConcurrentBoardReads = 4

// Shared, not per-call: one board connection is one session budget, and two
// concurrent callers against a per-call semaphore put twice the cap in flight.
// It is also what bounds the frontend's fan-out, which is why that side needs no
// cap of its own: refetching 9 expanded directories at once with 5 sessions held
// lost an expansion in every round of 30 unlimited, 12 of 30 at cap 4, and none
// at cap 4 with the retry.
//
// Deliberately an unbounded wait, and the consequence is on the record: four
// slow listings stall every listing in the process, including the agent's
// mirror. The alternatives are worse. Proceeding without a slot abandons the cap;
// failing the attempt manufactures the partial listing this exists to prevent. A
// real deadline belongs one layer down, in the transport, which carries none
// today, so a genuinely hung connection blocks every caller with or without this
// limiter.
var boardReads = make(chan struct{}, maxConcurrentBoardReads)

// A refused session is transient, so a listing is retried before it counts as
// unreadable. Backoff is short because the contention it waits out is a poll or
// another listing finishing, not the board being busy.
var boardReadBackoff = []time.Duration{30 * time.Millisecond, 90 * time.Millisecond}

// UnreadableDirsError reports the directories whose listing still failed after
// retries. It accompanies a result that is complete apart from those subtrees,
// so callers that cannot tolerate a gap must treat it as fatal rather than
// ignore it: ListFiles' output becomes checkedApp.hashes, the set of paths known
// to exist on the board, and a silently short list there lets the agent treat
// live board files as deleted.
type UnreadableDirsError struct {
	Paths []string
}

func (e *UnreadableDirsError) Error() string {
	return "could not list: " + strings.Join(e.Paths, ", ")
}

// UnreadablePaths lets a caller that must not import this package (the agent's
// mirror, which reaches the board through its own seam) recognise a walk that is
// complete apart from these subtrees.
func (e *UnreadableDirsError) UnreadablePaths() []string {
	return e.Paths
}

// retryBoardRead runs read under the shared limiter, retrying an attempt the
// transport refused. The slot is taken and released per attempt, so a retry
// waits out contention without holding one another read could use.
func retryBoardRead(path string, read func() error) error {
	attempts := len(boardReadBackoff) + 1
	var err error
	for attempt := range attempts {
		if attempt > 0 {
			time.Sleep(boardReadBackoff[attempt-1])
		}
		err = readWithSlot(read)
		if err == nil {
			return nil
		}
		if !sessionRefused(err) {
			return err
		}
		slog.Warn("board read refused",
			"path", path, "attempt", attempt+1, "attempts", attempts, "error", err)
	}
	return err
}

// sessionRefused reports whether err is the transport declining to carry the
// command, rather than the command running and failing. Only the former is
// worth another round trip: retrying a missing directory or a permission denial
// spends three sessions plus backoff to arrive at the same answer.
func sessionRefused(err error) bool {
	// A dropped channel surfaces as the raw stream/socket error.
	if errors.Is(err, io.EOF) || errors.Is(err, net.ErrClosed) ||
		errors.Is(err, syscall.ECONNRESET) || errors.Is(err, syscall.EPIPE) {
		return true
	}
	// x/crypto/ssh reports a refused channel and a lost connection as plain
	// strings ("ssh: rejected: connect failed (open failed)"), so the text is
	// the only signal. A command that ran and failed comes back as an ExitError
	// ("Process exited with status 2") and matches none of these.
	msg := err.Error()
	for _, refusal := range []string{"ssh: rejected", "open failed", "connection lost"} {
		if strings.Contains(msg, refusal) {
			return true
		}
	}
	return false
}

func readWithSlot(read func() error) error {
	boardReads <- struct{}{}
	defer func() { <-boardReads }()
	return read()
}

// listDirEntries reads dir's entries through an fs.FS, bounded and retried.
func listDirEntries(fss fs.FS, dir string) ([]fs.DirEntry, error) {
	var entries []fs.DirEntry
	err := retryBoardRead(dir, func() error {
		f, err := fss.Open(dir)
		if err != nil {
			return err
		}
		defer f.Close()

		rd, ok := f.(fs.ReadDirFile)
		if !ok {
			return fmt.Errorf("not a directory: %s", dir)
		}

		entries, err = rd.ReadDir(0)
		return err
	})
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// ListConnEntries lists dir over a board connection, bounded and retried.
//
// The trailing slash is what makes a file fail: `ls -laQ` of a file prints one
// line and no "total" header, and ParseLsOutput drops the first line either way,
// so without it a file lists as an empty directory. With it ls stops at ENOTDIR.
// The parser never sees the path, so listing a real directory is unaffected.
func ListConnEntries(conn remote.RemoteConn, dir string) ([]remote.FileInfo, error) {
	var entries []remote.FileInfo
	err := retryBoardRead(dir, func() error {
		var err error
		entries, err = conn.List(strings.TrimSuffix(dir, "/") + "/")
		return err
	})
	if err != nil {
		return nil, err
	}
	return entries, nil
}

package watcher

import (
	"path"
	"time"
)

// suppressTTL is the grace window after a self-originated op is released, so a
// trailing event that lands just after the op finishes is still dropped. Kept
// above pollInterval so a self-write is still suppressed at the next poll tick.
const suppressTTL = 2 * pollInterval

// SuppressHold marks paths as self-originated for the full duration of a
// backend mutation, so the fs events it produces are dropped no matter how long
// the op runs. Every SuppressHold must be paired with a SuppressRelease.
func (m *WatchManager) SuppressHold(paths ...string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, p := range paths {
		if p == "" {
			continue
		}
		m.holds[path.Clean(p)]++
	}
}

// SuppressRelease ends a hold started by SuppressHold. When the last hold on a
// path is released it converts to a short time-based grace window, so a
// trailing event that lands just after the op finishes is still dropped.
func (m *WatchManager) SuppressRelease(paths ...string) {
	now := time.Now()
	until := now.Add(suppressTTL)
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, t := range m.suppress {
		if now.After(t) {
			delete(m.suppress, k)
		}
	}
	for _, p := range paths {
		if p == "" {
			continue
		}
		key := path.Clean(p)
		if m.holds[key] <= 1 {
			delete(m.holds, key)
			m.suppress[key] = until
		} else {
			m.holds[key]--
		}
	}
}

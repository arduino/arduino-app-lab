// Progress event types whose JSON shape mirrors the TS RuntimeProgress contract.

package airuntime

// Phase identifies the stage of an install (mirrors the TS RuntimePhase union).
type Phase string

const (
	PhaseIdle     Phase = "idle"
	PhaseDownload Phase = "download"
	PhaseVerify   Phase = "verify"
	PhaseExtract  Phase = "extract"
	PhaseNpm      Phase = "npm"
	PhaseDone     Phase = "done"
	PhaseError    Phase = "error"
)

// Progress is one install progress event; JSON tags match TS RuntimeProgress.
type Progress struct {
	Phase   Phase    `json:"phase"`
	Pct     *float64 `json:"pct,omitempty"`
	Message string   `json:"message,omitempty"`
}

// Per-phase progress milestones so the bar advances monotonically; only download has real sub-progress (0..pctDownloadMax).
const (
	pctDownloadMax = 50.0
	pctVerify      = 55.0
	pctExtract     = 65.0
	pctNpm         = 90.0 // no sub-progress from `npm ci`; the bar sits here for the phase's duration
	pctDone        = 100.0
)

// pctOf returns a pointer to v for Progress.Pct.
func pctOf(v float64) *float64 { return &v }

// ProgressFunc receives install progress events (keeps this package Wails-free).
type ProgressFunc func(Progress)

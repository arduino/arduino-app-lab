package app

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"app-lab-desktop/internal/board"
	"app-lab-desktop/internal/carrier"
)

// The board's real output (an UNO Q with a Media Carrier attached): two Venus codec nodes and the DP connector.
const realMediaNodes = `V|video0|qcom-venus-encoder
V|video1|qcom-venus-decoder
D|card0-DP-1|disconnected|disabled
`

func TestParseMediaNodes(t *testing.T) {
	video, displays := parseMediaNodes(realMediaNodes)
	if len(video) != 2 || video[0].Path != "/dev/video0" || video[0].Name != "qcom-venus-encoder" {
		t.Fatalf("video nodes: %+v", video)
	}
	if len(displays) != 1 {
		t.Fatalf("displays: %+v", displays)
	}
	// The card prefix is dropped: the user reads the port as DP-1, not card0-DP-1.
	if d := displays[0]; d.Connector != "DP-1" || d.Status != "disconnected" || d.Enabled {
		t.Errorf("connector: %+v", d)
	}
}

// A short or unknown line is skipped: a probe that returns junk must not fail the whole status call.
func TestParseMediaNodesSkipsJunk(t *testing.T) {
	video, displays := parseMediaNodes("V|video0\nX|whatever|x|y\n\nD|card0-DP-1|connected|enabled\n")
	if len(video) != 0 {
		t.Errorf("a 2-field V line is not a node: %+v", video)
	}
	if len(displays) != 1 || !displays[0].Enabled || displays[0].Status != "connected" {
		t.Errorf("displays: %+v", displays)
	}
}

// The board's real carrier list and show output, so the merge is pinned against what the hardware answers.
const (
	realCarrierList = `{"carriers":[{"name":"media-carrier","devices":[
		{"name":"camera0","device_type":"camera","available_devices":["none","type1-2lanes","type1-4lanes"]},
		{"name":"display","device_type":"display","available_devices":["none","5-dsi-touch-a"]}]}]}`
	realCarrierShow = `{"carriers":[{"carrier_name":"media-carrier","current_enabled":false,"next_enabled":false,
		"current":[{"device":"camera0","option":"none","device_type":"camera"},
		           {"device":"display","option":"none","device_type":"display"}],
		"next":[{"device":"camera0","option":"none","device_type":"camera"},
		        {"device":"display","option":"none","device_type":"display"}]}]}`
)

func fixture(t *testing.T) (carrier.Carrier, carrier.ShowResult) {
	t.Helper()
	var list carrier.CarrierResponse
	var shown carrier.ShowResult
	if err := json.Unmarshal([]byte(realCarrierList), &list); err != nil {
		t.Fatalf("list fixture: %v", err)
	}
	if err := json.Unmarshal([]byte(realCarrierShow), &shown); err != nil {
		t.Fatalf("show fixture: %v", err)
	}
	return list.Carriers[0], shown
}

// Without attached=unknown the agent answers "no" to "is a carrier connected?", which the board cannot know.
func TestMergeCarrierReportsPresenceUnknownWhileDisabled(t *testing.T) {
	c, shown := fixture(t)
	cfg := mergeCarrier(c, shown)
	if cfg.Attached != "unknown" {
		t.Errorf("attached: %q", cfg.Attached)
	}
	if cfg.Enabled == nil || *cfg.Enabled || cfg.EnabledNextBoot == nil || *cfg.EnabledNextBoot {
		t.Errorf("enabled flags: %+v", cfg)
	}
	// A read that returned false still has to reach the payload as false; omitempty must only drop the nil.
	if j, err := json.Marshal(cfg); err != nil || !strings.Contains(string(j), `"enabled":false`) {
		t.Errorf("enabled must marshal as false: %s (%v)", j, err)
	}
	if len(cfg.Devices) != 2 || cfg.Devices[0].Name != "camera0" || cfg.Devices[0].Option != "none" {
		t.Fatalf("devices: %+v", cfg.Devices)
	}
	// The options come from the catalogue, which show does not carry.
	if len(cfg.Devices[0].Options) != 3 {
		t.Errorf("options: %+v", cfg.Devices[0].Options)
	}
	// current == next, so nothing is staged and the field stays out of the payload.
	if cfg.Devices[0].OptionNextBoot != "" {
		t.Errorf("optionNextBoot must be omitted when it matches: %q", cfg.Devices[0].OptionNextBoot)
	}
}

// A change staged for the next boot is the one thing a user cannot see coming, so it must surface.
func TestMergeCarrierSurfacesAStagedChange(t *testing.T) {
	c, shown := fixture(t)
	shown.Carriers[0].NextDevices[0].Option = "type1-2lanes"
	cfg := mergeCarrier(c, shown)
	if cfg.Devices[0].OptionNextBoot != "type1-2lanes" {
		t.Errorf("staged option: %+v", cfg.Devices[0])
	}
}

// A slot listed for the next boot but not for the current one tells us nothing was staged: the current
// option simply was not read. Reporting a staged change there is the one false positive that matters,
// since a staged change is what the payload exists to surface.
func TestMergeCarrierStagesNothingWhenTheCurrentOptionWasNotRead(t *testing.T) {
	c, shown := fixture(t)
	shown.Carriers[0].CurrentDevices = shown.Carriers[0].CurrentDevices[1:] // camera0 drops out
	shown.Carriers[0].NextDevices[0].Option = "type1-2lanes"

	cfg := mergeCarrier(c, shown)
	if cfg.Devices[0].Name != "camera0" {
		t.Fatalf("devices: %+v", cfg.Devices)
	}
	if cfg.Devices[0].Option != "" {
		t.Errorf("option must stay absent when it was not read: %q", cfg.Devices[0].Option)
	}
	if cfg.Devices[0].OptionNextBoot != "" {
		t.Errorf("nothing was staged, so the field must stay out: %q", cfg.Devices[0].OptionNextBoot)
	}
}

// Once enabled the video and display nodes are the evidence, so the presence hint would only mislead.
func TestMergeCarrierDropsThePresenceHintWhenEnabled(t *testing.T) {
	c, shown := fixture(t)
	shown.Carriers[0].CurrentEnabled = true
	if cfg := mergeCarrier(c, shown); cfg.Attached != "" {
		t.Errorf("attached: %q", cfg.Attached)
	}
}

// A carrier whose configuration could not be read must still reach the payload, named and marked: dropping it
// leaves the agent with no carrier object at all, which it reports as "no carrier is attached".
func TestCarrierConfigKeepsTheCarrierWhenShowFails(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel() // past the deadline: awaitBoard refuses to dispatch
	cfg, err := carrierConfig(ctx, board.Noop().Conn, carrier.Carrier{Name: "media-carrier"})
	if err == nil {
		t.Fatal("a failed show must report an error so the caller can mark it unread")
	}
	if cfg.Name != "media-carrier" || cfg.Attached != "unknown" {
		t.Errorf("the carrier must stay identifiable: %+v", cfg)
	}
	if cfg.Enabled != nil {
		t.Errorf("enabled must stay absent on a failed read: %+v", cfg)
	}
}

// A show output that names no matching carrier is a read that told us nothing: enabled must stay absent from the
// payload rather than marshal as false, which the agent would report as "the carrier is disabled".
func TestMergeCarrierLeavesEnabledAbsentWhenShowNamesNoCarrier(t *testing.T) {
	c, shown := fixture(t)
	shown.Carriers[0].CarrierName = "other-carrier"
	cfg := mergeCarrier(c, shown)
	if cfg.Enabled != nil || cfg.EnabledNextBoot != nil {
		t.Errorf("enabled flags must be nil: %+v", cfg)
	}
	if cfg.Attached != "unknown" {
		t.Errorf("attached: %q", cfg.Attached)
	}
	j, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(j), `"enabled"`) {
		t.Errorf("enabled must not appear in the payload: %s", j)
	}
}

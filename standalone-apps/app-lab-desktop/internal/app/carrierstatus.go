package app

import (
	"context"
	"strings"
	"time"

	"app-lab-desktop/internal/boardmcp"
	"app-lab-desktop/internal/carrier"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

// carrierStatusTimeout bounds the whole probe: two board commands plus one per carrier, none of which should take long.
const carrierStatusTimeout = 20 * time.Second

// mediaNodesCommand dumps what the kernel exposes, in one round trip: video4linux nodes and DRM connectors.
const mediaNodesCommand = `for d in /sys/class/video4linux/video*; do [ -e "$d/name" ] || continue; echo "V|$(basename $d)|$(cat $d/name 2>/dev/null)"; done
for c in /sys/class/drm/card*-*; do [ -e "$c/status" ] || continue; echo "D|$(basename $c)|$(cat $c/status 2>/dev/null)|$(cat $c/enabled 2>/dev/null)"; done`

// CarrierStatus reads what is configured and what the kernel exposes. A probe that fails is named in Unread, so a
// missing field can never be read as absent hardware.
func (b boardAccess) CarrierStatus(ctx context.Context) (boardmcp.CarrierStatus, error) {
	// One snapshot: on the agent's goroutine, a same-board re-select overwrites the board field by field.
	sb := b.app.boardSnapshot()
	if !sb.HasConn() { // every part of this is read over the connection
		return boardmcp.CarrierStatus{Connected: false}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, carrierStatusTimeout)
	defer cancel()

	out := boardmcp.CarrierStatus{Connected: true}
	carriers, err := awaitBoard(ctx, func() ([]carrier.Carrier, error) {
		list, err := carrier.List(ctx, sb.Conn)
		return list.Carriers, err
	})
	if err != nil {
		out.Unread = append(out.Unread, "carriers")
	} else {
		for _, c := range carriers {
			cfg, err := carrierConfig(ctx, sb.Conn, c)
			if err != nil {
				out.Unread = append(out.Unread, "carriers/"+c.Name)
			}
			out.Carriers = append(out.Carriers, cfg)
		}
	}
	if raw, err := execOnBoard(ctx, sb, mediaNodesCommand); err == nil {
		out.VideoDevices, out.Displays = parseMediaNodes(string(raw))
	} else {
		out.Unread = append(out.Unread, "videoDevices", "displays")
	}
	return out, nil
}

// carrierConfig reads a carrier's configuration and merges it with its slot catalogue. On error it still returns the
// carrier's name, so the caller can mark it unread instead of dropping it from the payload.
func carrierConfig(ctx context.Context, conn remote.RemoteConn, c carrier.Carrier) (boardmcp.CarrierConfig, error) {
	shown, err := awaitBoard(ctx, func() (carrier.ShowResult, error) {
		return carrier.Show(ctx, conn)
	})
	if err != nil {
		return boardmcp.CarrierConfig{Name: c.Name, Attached: "unknown"}, err
	}
	return mergeCarrier(c, shown), nil
}

// mergeCarrier pairs the slot catalogue with the configuration, keyed by slot name.
func mergeCarrier(c carrier.Carrier, shown carrier.ShowResult) boardmcp.CarrierConfig {
	cfg := boardmcp.CarrierConfig{Name: c.Name, Attached: "unknown"}
	current, next := map[string]string{}, map[string]string{}
	for _, sc := range shown.Carriers {
		if sc.CarrierName != c.Name {
			continue
		}
		enabled, nextEnabled := sc.CurrentEnabled, sc.NextEnabled
		cfg.Enabled, cfg.EnabledNextBoot = &enabled, &nextEnabled
		if sc.CurrentEnabled {
			cfg.Attached = "" // enabled: the video and display nodes are the evidence, so the field would only mislead
		}
		for _, d := range sc.CurrentDevices {
			current[d.Device] = d.Option
		}
		for _, d := range sc.NextDevices {
			next[d.Device] = d.Option
		}
	}
	for _, d := range c.Devices {
		cur, read := current[d.Name]
		device := boardmcp.CarrierDevice{
			Name:    d.Name,
			Type:    d.DeviceType,
			Option:  cur,
			Options: d.AvailableDevices,
		}
		// Emitted only when a change is staged, so it cannot be missed — and only when the current option was
		// read, since an unread one is "" and would make any next value look like a change.
		if n, ok := next[d.Name]; ok && read && n != cur {
			device.OptionNextBoot = n
		}
		cfg.Devices = append(cfg.Devices, device)
	}
	return cfg
}

// parseMediaNodes reads the mediaNodesCommand output; a malformed line is skipped rather than failing the probe.
func parseMediaNodes(raw string) ([]boardmcp.VideoDevice, []boardmcp.DisplayConnector) {
	var video []boardmcp.VideoDevice
	var displays []boardmcp.DisplayConnector
	for _, line := range strings.Split(raw, "\n") {
		parts := strings.Split(strings.TrimSpace(line), "|")
		switch {
		case len(parts) == 3 && parts[0] == "V":
			video = append(video, boardmcp.VideoDevice{Path: "/dev/" + parts[1], Name: parts[2]})
		case len(parts) == 4 && parts[0] == "D":
			displays = append(displays, boardmcp.DisplayConnector{
				Connector: connectorName(parts[1]),
				Status:    parts[2],
				Enabled:   parts[3] == "enabled",
			})
		}
	}
	return video, displays
}

// connectorName drops the DRM card prefix: "card0-DP-1" is the port the user sees as "DP-1".
func connectorName(dir string) string {
	if _, name, found := strings.Cut(dir, "-"); found {
		return name
	}
	return dir
}

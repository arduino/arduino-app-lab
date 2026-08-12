package featureflags

import "os"

var feature_flags = []string{
	"SHOW_VERSION_IN_FOOTER",
	"UPDATE_IN_DEV_MODE",
	"AI_ASSISTANT",
}

// Flags on unless explicitly set to "false" (opt-out); every other flag stays off unless set to "true".
var defaultOn = map[string]bool{
	"AI_ASSISTANT": true,
}

func enabled(ff string) bool {
	value, exists := os.LookupEnv(ff)
	if !exists {
		return defaultOn[ff]
	}
	return value == "true"
}

func GetFeatureFlags() []string {
	flags := make([]string, 0)
	for _, s := range feature_flags {
		if !enabled(s) {
			continue
		}
		flags = append(flags, s)
	}

	return flags
}

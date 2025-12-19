package featureflags

import "os"

var feature_flags = []string{
	"SHOW_VERSION_IN_FOOTER",
}

func enabled(ff string) bool {
	value, exists := os.LookupEnv(ff)
	if !exists {
		return false
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

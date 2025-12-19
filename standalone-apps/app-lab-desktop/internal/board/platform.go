package board

import (
	"os"
	"slices"
	"sync"
)

var onBoard = sync.OnceValue(func() bool {
	var boardNames = []string{"UNO Q\n", "Imola\n", "Inc. Robotics RB1\n"}
	buf, err := os.ReadFile("/sys/class/dmi/id/product_name")
	if err == nil && slices.Contains(boardNames, string(buf)) {
		return true
	}
	return false
})()

func IsSBC() bool {
	return onBoard
}

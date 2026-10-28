package terminal

// TerminalInfo describes a terminal emulator known to the application.
type TerminalInfo struct {
	// ID is the name of the executable, it is the stable identifier of the terminal.
	ID string `json:"id"`
	// Label is the human readable name of the terminal, shown in the UI.
	Label string `json:"label"`
	// Path is the absolute path of the executable, it is empty when the
	// terminal is not installed.
	Path string `json:"path"`
	// Available tells whether the terminal is installed on the system.
	Available bool `json:"available"`
}

// TerminalCatalog is the list of the terminal emulators available on the system.
type TerminalCatalog struct {
	// Supported is false on the platforms where the terminal emulators are not
	// detected from the system, in that case the user cannot pick one.
	Supported bool `json:"supported"`
	// Terminals are the detected terminal emulators, in the order they are tried.
	Terminals []TerminalInfo `json:"terminals"`
}

// ListAvailable returns the terminal emulators known to the application, in the
// order they are tried when no terminal has been explicitly selected. The
// terminals that are not installed are reported with Available set to false, so
// the user can tell that the terminal they selected is gone.
func ListAvailable() TerminalCatalog {
	return TerminalCatalog{
		Supported: terminalSelectionSupported,
		Terminals: detectTerminals(),
	}
}

package agent

import "fmt"

// focusParagraph opens the scope paragraph; an engine without a session envelope gets it after the first prompt's text, which the replay cuts there.
const focusParagraph = "\n\nWorkspace. The user opened this session on the app "

// workspaceFocus tells the agent which app the session was opened on. It only steers now: the permission layer is what actually stops a cross-app action, so the paragraph no longer has to carry the whole feature.
func workspaceFocus(ws SessionWorkspace) string {
	if ws.AppID == "" {
		return "" // general workspace: the whole board, which is what the rest of the prompt already describes
	}
	name := ws.Name
	if name == "" {
		name = ws.AppID
	}
	return fmt.Sprintf(focusParagraph+"%q (id %s): that app is the subject of the conversation, so work on it unless they clearly ask otherwise, and check it out with apps_checkout before reading or editing its files. You can read the rest of the board freely. Acting on another app is not forbidden, but say so first — App Lab asks the user to confirm anything that lands outside %[1]q, so claiming it is done before they have answered would be wrong. A new app you create or clone is one of those: it is an ordinary board app beside this one, never inside it, and this session stays on %[1]q whatever you create.", name, ws.AppID)
}

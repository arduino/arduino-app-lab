// Package boardmcp is the in-process HTTP MCP server exposing board tools to the agent, reaching the board only via BoardAccess.
package boardmcp

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Server is the in-process MCP HTTP endpoint handed to the agent (localhost, bearer-token gated).
type Server struct {
	url      string
	token    string
	http     *http.Server
	ln       net.Listener
	readOnly []string // read-only tool names (auto-approved: no permission prompt)
}

// Start launches the board MCP server on 127.0.0.1:<random> with a per-run bearer token.
func Start(access BoardAccess) (*Server, error) {
	token, err := randomToken()
	if err != nil {
		return nil, err
	}

	srv := mcp.NewServer(&mcp.Implementation{Name: "arduino-board", Version: "0.1.0"}, nil)
	readOnly := []string{
		registerAppsList(srv, access),
		registerAppsGet(srv, access),
		registerAppsCheckout(srv, access),
		registerAppsLogs(srv, access),
		registerAppsWaitRunning(srv, access),
		registerBoardStatus(srv, access),
		registerBoardsList(srv, access),
		registerWifiStatus(srv, access),
		registerBricksList(srv, access),
		registerBricksGet(srv, access),
		registerAppBricksList(srv, access),
		registerModelsList(srv, access),
		registerSketchLibrariesList(srv, access),
		registerSystemResources(srv, access),
		registerSystemName(srv, access),
	}
	// Mutating tools: registered but omitted from readOnly, so the agent must get user permission before running them.
	registerAppsCreate(srv, access)
	registerAppsStart(srv, access)
	registerAppsStop(srv, access)
	registerAppsDelete(srv, access)
	registerAppsEdit(srv, access)
	registerAppsClone(srv, access)
	registerAppBricksAdd(srv, access)
	registerAppBricksUpdate(srv, access)
	registerAppBricksRemove(srv, access)
	registerModelsDelete(srv, access)
	registerSketchLibrariesAdd(srv, access)
	registerSketchLibrariesRemove(srv, access)
	registerBoardExec(srv, access)

	handler := mcp.NewStreamableHTTPHandler(
		func(*http.Request) *mcp.Server { return srv },
		&mcp.StreamableHTTPOptions{Stateless: true},
	)
	mux := http.NewServeMux()
	mux.Handle("/mcp", bearerAuth(token, handler))

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	s := &Server{
		url:      fmt.Sprintf("http://%s/mcp", ln.Addr().String()),
		token:    token,
		http:     &http.Server{Handler: mux},
		ln:       ln,
		readOnly: readOnly,
	}
	go func() {
		if err := s.http.Serve(ln); err != nil && err != http.ErrServerClosed {
			slog.Error("boardmcp server stopped", "err", err)
		}
	}()
	slog.Info("boardmcp server started", "url", s.url)
	return s, nil
}

// URL is the MCP endpoint to hand the agent.
func (s *Server) URL() string { return s.url }

// Token is the per-run bearer token required on every request.
func (s *Server) Token() string { return s.token }

// ReadOnlyToolNames lists the read-only tools the agent may auto-approve (no permission prompt).
func (s *Server) ReadOnlyToolNames() []string { return append([]string(nil), s.readOnly...) }

// Stop shuts the server down.
func (s *Server) Stop() error {
	if s == nil || s.http == nil {
		return nil
	}
	return s.http.Close()
}

// bearerAuth rejects any request whose Authorization header isn't the exact bearer token.
func bearerAuth(token string, next http.Handler) http.Handler {
	want := []byte("Bearer " + token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := []byte(r.Header.Get("Authorization"))
		if subtle.ConstantTimeCompare(got, want) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

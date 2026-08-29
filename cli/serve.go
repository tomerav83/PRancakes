package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// ghTimeout bounds one gh read, so a stalled query becomes an error the page
// can show rather than a spinner that never stops.
const ghTimeout = 30 * time.Second

// serveCmd runs the local viewer: gh on demand behind an HTTP endpoint, with
// the built site served from the same origin so the browser side needs no
// CORS, no configured base URL and no token of its own.
func serveCmd(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ContinueOnError)
	port := fs.Int("port", 8080, "port to listen on")
	site := fs.String("site", defaultSiteDir(), "directory holding the built site")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() > 0 {
		return fmt.Errorf("unexpected argument %q — serve takes flags only", fs.Arg(0))
	}
	if *port < 0 || *port > 65535 {
		return fmt.Errorf("port %d is out of range", *port)
	}

	ln, err := listenLoopback(*port)
	if err != nil {
		return err
	}

	fmt.Printf("prancakes: serving http://%s/stack\n", ln.Addr())
	srv := &http.Server{
		Handler:           router(*site, collect),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      ghTimeout + 15*time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	return srv.Serve(ln)
}

// listenLoopback binds the loopback interface only. This server answers with
// a private repository's state and has no authentication of its own, so it
// must not be reachable from the network.
func listenLoopback(port int) (net.Listener, error) {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		if errors.Is(err, syscall.EADDRINUSE) {
			return nil, fmt.Errorf("port %d is already in use — is another prancakes already serving?", port)
		}
		return nil, fmt.Errorf("cannot listen on %s: %w", addr, err)
	}
	return ln, nil
}

// stackHandler answers with the same Doc the --json flag prints, so one
// contract serves both. read is injected so tests never reach the network.
func stackHandler(read func(context.Context) (Doc, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Reading is the only thing this endpoint does; nothing else should
		// reach a gh subprocess.
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// gh can stall on a network hiccup or a credential prompt. A deadline
		// turns that into an error the page can show, instead of a request
		// that never answers.
		ctx, cancel := context.WithTimeout(r.Context(), ghTimeout)
		defer cancel()

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		// The whole point of the view is that it is current; a cached copy
		// of it would be a lie.
		w.Header().Set("Cache-Control", "no-store")

		doc, err := read(ctx)
		if err != nil {
			// gh's own message, verbatim — "gh auth login" has to survive the
			// trip to the browser or the user is stuck.
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		// Encode before writing: failing halfway through would otherwise ship
		// truncated JSON under a 200.
		body, err := json.MarshalIndent(doc, "", "  ")
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		_, _ = w.Write(append(body, '\n'))
	})
}

// router wires the two halves together. Assembled here rather than inline in
// serveCmd so a test can drive the real paths: handlers tested in isolation
// pass happily even when nothing routes to them.
func router(site string, read func(context.Context) (Doc, error)) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/api/stack", stackHandler(read))
	mux.Handle("/", siteHandler(site))
	return loopbackOnly(mux)
}

// loopbackOnly rejects requests whose Host is not this machine. Binding to
// 127.0.0.1 is not enough on its own: a hostile page on a domain that resolves
// to 127.0.0.1 is same-origin with this server, so CORS never applies and the
// Host header is what tells the two apart.
func loopbackOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if h, _, err := net.SplitHostPort(host); err == nil {
			host = h
		}
		switch strings.ToLower(strings.Trim(host, "[]")) {
		case "127.0.0.1", "localhost", "::1":
			next.ServeHTTP(w, r)
		default:
			http.Error(w, "prancakes serves 127.0.0.1 only", http.StatusForbidden)
		}
	})
}

// siteHandler serves the built export. When it is missing the API still runs,
// so the answer is instructions rather than a 404 nobody can act on.
func siteHandler(dir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Checked per request rather than once at startup: starting the
		// server and then building the site is the obvious order to do it in.
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprintf(w, "The site is not built yet:\n\n    cd web && npm run build\n\nThe API is already up at http://%s/api/stack\n", r.Host)
			return
		}

		root := http.Dir(dir)
		name := path.Clean("/" + r.URL.Path)

		// Next exports the /stack route as stack.html. A static host resolves
		// that mapping; http.FileServer does not, and would answer /stack/
		// with a directory listing of the sibling payload directory instead.
		for _, candidate := range []string{name + ".html", name, path.Join(name, "index.html")} {
			if candidate == "/.html" {
				continue
			}
			if info, ok := stat(root, candidate); ok && !info.IsDir() {
				http.ServeFile(w, r, filepath.Join(dir, filepath.FromSlash(candidate)))
				return
			}
		}

		// Nothing matched. Directories deliberately fall through to here
		// rather than being listed, which would expose the whole export tree.
		serveNotFound(w, r, dir, root)
	})
}

// serveNotFound prefers the export's own 404 page: the stdlib's plain text
// would be the only unbranded screen in the app.
func serveNotFound(w http.ResponseWriter, r *http.Request, dir string, root http.FileSystem) {
	page, err := root.Open("/404.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer page.Close()

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	_, _ = io.Copy(w, page)
}

func stat(root http.FileSystem, name string) (os.FileInfo, bool) {
	f, err := root.Open(name)
	if err != nil {
		return nil, false
	}
	defer f.Close()
	info, err := f.Stat()
	return info, err == nil
}

// defaultSiteDir finds the export. Candidates must actually contain the page
// this tool serves: `prancakes serve` runs inside the user's own repository,
// and a stray web/out of theirs must not be mistaken for ours.
func defaultSiteDir() string {
	candidates := []string{"web/out", "../web/out"}
	if exe, err := os.Executable(); err == nil {
		near := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(near, "web", "out"),
			filepath.Join(near, "..", "web", "out"))
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(filepath.Join(candidate, "stack.html")); err == nil && !info.IsDir() {
			return candidate
		}
	}
	return "web/out"
}

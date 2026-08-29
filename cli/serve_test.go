package main

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func sampleDoc() Doc {
	return Doc{
		Repo: "owner/repo", DefaultBranch: "master", CurrentBranch: "feat/a",
		GeneratedAt: "2026-08-29T00:00:00Z",
		Stacks: []Stack{{Base: "master", PRs: []PR{{
			Number: 1, Title: "t", Branch: "feat/a", Base: "master",
			Current: true, Checks: "passing", URL: "u", Mergeable: "MERGEABLE",
		}}}},
	}
}

func TestStackHandlerServesTheDocument(t *testing.T) {
	rec := httptest.NewRecorder()
	stackHandler(func(context.Context) (Doc, error) { return sampleDoc(), nil }).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/stack", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type = %q, want JSON", ct)
	}
	// A cached snapshot of "the current state" is a wrong answer, not a stale one.
	if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", cc)
	}

	var got Doc
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("body is not JSON: %v\n%s", err, rec.Body.String())
	}
	if got.Repo != "owner/repo" || len(got.Stacks) != 1 || got.Stacks[0].PRs[0].Number != 1 {
		t.Errorf("decoded document = %+v, want the one the collector returned", got)
	}
}

func TestStackHandlerKeepsTheKeysThePageReads(t *testing.T) {
	rec := httptest.NewRecorder()
	stackHandler(func(context.Context) (Doc, error) { return sampleDoc(), nil }).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/stack", nil))

	var decoded map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("body is not JSON: %v", err)
	}
	for _, key := range []string{"repo", "defaultBranch", "currentBranch", "generatedAt", "stacks"} {
		if _, ok := decoded[key]; !ok {
			t.Errorf("key %q missing from the endpoint's document", key)
		}
	}
}

func TestStackHandlerPassesGhsMessageThrough(t *testing.T) {
	rec := httptest.NewRecorder()
	stackHandler(func(context.Context) (Doc, error) {
		return Doc{}, errors.New("`gh pr list` failed: not logged in\n  fix: gh auth login")
	}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/stack", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("error body is not JSON: %v\n%s", err, rec.Body.String())
	}
	// The remedy has to survive the trip to the browser, or the user is stuck.
	if !strings.Contains(body.Error, "gh auth login") {
		t.Errorf("error = %q, want gh's own message including the remedy", body.Error)
	}
}

// The export Next actually produces: `stack.html` at the root, plus a sibling
// `stack/` directory holding RSC payloads. Serving that directory instead of
// the page is the failure this pins.
func exportDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "stack"), 0o755); err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{
		"index.html":             "<h1>home</h1>",
		"stack.html":             "<h1>stack</h1>",
		"stack/__next._full.txt": "rsc payload",
	} {
		if err := os.WriteFile(filepath.Join(dir, filepath.FromSlash(name)), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func TestSiteHandlerServesTheBuiltExport(t *testing.T) {
	dir := exportDir(t)

	for _, requested := range []string{"/", "/stack", "/stack/"} {
		rec := httptest.NewRecorder()
		siteHandler(dir).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, requested, nil))
		if rec.Code != http.StatusOK {
			t.Errorf("GET %s = %d, want 200", requested, rec.Code)
			continue
		}
		want := "<h1>stack</h1>"
		if requested == "/" {
			want = "<h1>home</h1>"
		}
		if !strings.Contains(rec.Body.String(), want) {
			t.Errorf("GET %s served %q, want %q", requested, rec.Body.String(), want)
		}
	}
}

func TestSiteHandlerNeverListsADirectory(t *testing.T) {
	dir := exportDir(t)
	if err := os.MkdirAll(filepath.Join(dir, "_next", "static"), 0o755); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	siteHandler(dir).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/_next/static/", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("GET /_next/static/ = %d, want 404 — a listing exposes the export tree", rec.Code)
	}
}

// Handlers tested in isolation pass even when nothing routes to them: these
// drive the real paths the page fetches.
func TestRouterRoutesTheDocumentedPaths(t *testing.T) {
	dir := exportDir(t)
	handler := router(dir, func(context.Context) (Doc, error) { return sampleDoc(), nil })

	// The router carries the loopback guard, so requests must look local.
	local := func(target string) *http.Request {
		req := httptest.NewRequest(http.MethodGet, target, nil)
		req.Host = "127.0.0.1:8080"
		return req
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, local("/api/stack"))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/stack = %d, want 200", rec.Code)
	}
	var doc Doc
	if err := json.Unmarshal(rec.Body.Bytes(), &doc); err != nil {
		t.Fatalf("GET /api/stack did not answer JSON: %v", err)
	}
	if doc.Repo != "owner/repo" {
		t.Errorf("GET /api/stack served %+v, want the collector's document", doc)
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, local("/stack"))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<h1>stack</h1>") {
		t.Errorf("GET /stack = %d %q, want the exported page", rec.Code, rec.Body.String())
	}

	// And the guard is actually wired in, not just defined.
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/stack", nil))
	if rec.Code != http.StatusForbidden {
		t.Errorf("GET /api/stack from a foreign Host = %d, want 403", rec.Code)
	}
}

func TestSiteHandlerServesTheBrandedNotFound(t *testing.T) {
	dir := exportDir(t)
	if err := os.WriteFile(filepath.Join(dir, "404.html"), []byte("<h1>lost</h1>"), 0o644); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	siteHandler(dir).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/nowhere", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "<h1>lost</h1>") {
		t.Errorf("body = %q, want the export's own 404 page", rec.Body.String())
	}
}

func TestDefaultSiteDirIgnoresAForeignBuildDirectory(t *testing.T) {
	home, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(home) })

	// Someone else's repository that happens to have a web/out of its own.
	stranger := t.TempDir()
	if err := os.MkdirAll(filepath.Join(stranger, "web", "out"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(stranger); err != nil {
		t.Fatal(err)
	}
	if got := defaultSiteDir(); got != "web/out" {
		t.Errorf("defaultSiteDir() = %q in a foreign repo; it must not adopt a build that is not ours", got)
	}
	// The fallback is only a name — nothing there is served.
	if _, err := os.Stat(filepath.Join("web", "out", "stack.html")); err == nil {
		t.Fatal("fixture unexpectedly contains our page")
	}

	// Our own tree, run from cli/ as the README documents.
	ours := t.TempDir()
	if err := os.MkdirAll(filepath.Join(ours, "web", "out"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(ours, "web", "out", "stack.html"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(ours, "cli"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(filepath.Join(ours, "cli")); err != nil {
		t.Fatal(err)
	}
	if got := defaultSiteDir(); got != "../web/out" {
		t.Errorf("defaultSiteDir() = %q from cli/, want ../web/out", got)
	}
}

func TestStackHandlerRefusesWritingMethods(t *testing.T) {
	called := false
	rec := httptest.NewRecorder()
	stackHandler(func(context.Context) (Doc, error) {
		called = true
		return sampleDoc(), nil
	}).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/stack", nil))

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST = %d, want 405", rec.Code)
	}
	// A write method must not reach a gh subprocess at all.
	if called {
		t.Error("POST reached the collector")
	}
}

func TestLoopbackOnlyRejectsARebindingHost(t *testing.T) {
	guarded := loopbackOnly(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for _, host := range []string{"127.0.0.1:8080", "localhost:8080", "[::1]:8080", "localhost"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/stack", nil)
		req.Host = host
		guarded.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("Host %q = %d, want it allowed", host, rec.Code)
		}
	}

	// A domain the attacker controls, rebound to 127.0.0.1, is same-origin
	// with this server — the Host header is the only thing that tells them
	// apart, so it has to be checked.
	for _, host := range []string{"evil.test", "evil.test:8080", "attacker.example.com"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/stack", nil)
		req.Host = host
		guarded.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Errorf("Host %q = %d, want 403", host, rec.Code)
		}
	}
}

func TestSiteHandlerNoticesASiteBuiltAfterStartup(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "out")
	handler := siteHandler(dir)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/stack", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("before the build: %d, want 503", rec.Code)
	}

	// Starting the server and then building is the obvious order; the handler
	// has to notice rather than answer 503 for the rest of the session.
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "stack.html"), []byte("<h1>stack</h1>"), 0o644); err != nil {
		t.Fatal(err)
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/stack", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<h1>stack</h1>") {
		t.Errorf("after the build: %d %q, want the page", rec.Code, rec.Body.String())
	}
}

func TestSiteHandlerExplainsAMissingBuild(t *testing.T) {
	rec := httptest.NewRecorder()
	siteHandler(filepath.Join(t.TempDir(), "never-built")).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/stack", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "npm run build") {
		t.Errorf("body = %q, want the build command", rec.Body.String())
	}
}

func TestListenLoopbackBindsLoopbackAndNamesATakenPort(t *testing.T) {
	first, err := listenLoopback(0)
	if err != nil {
		t.Fatalf("listening: %v", err)
	}
	defer first.Close()

	// Nothing outside this machine may reach a view of a private repository.
	if host := first.Addr().String(); !strings.HasPrefix(host, "127.0.0.1:") {
		t.Errorf("listening on %q, want loopback only", host)
	}

	port := first.Addr().(*net.TCPAddr).Port
	if _, err := listenLoopback(port); err == nil {
		t.Fatal("expected an error binding a port already in use")
	} else if !strings.Contains(err.Error(), strconv.Itoa(port)) {
		t.Errorf("error = %q, want it to name the port", err)
	}
}

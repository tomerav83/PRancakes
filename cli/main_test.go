package main

import (
	"bytes"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"
)

func pr(number int, head, base string) ghPR {
	return ghPR{Number: number, Title: head, HeadRefName: head, BaseRefName: base}
}

// row is one flattened pull request: what the renderer actually consumes.
type row struct {
	number  int
	depth   int
	current bool
}

// forkPR is a pull request opened from someone else's fork.
func forkPR(number int, owner, head, base string) ghPR {
	p := pr(number, head, base)
	p.IsCrossRepository = true
	p.HeadRepositoryOwner.Login = owner
	return p
}

func flatten(stacks []Stack) (bases []string, rows []row) {
	for _, st := range stacks {
		bases = append(bases, st.Base)
		for _, p := range st.PRs {
			rows = append(rows, row{number: p.Number, depth: p.Depth, current: p.Current})
		}
	}
	return bases, rows
}

func TestBuildStacks(t *testing.T) {
	tests := []struct {
		name          string
		prs           []ghPR
		currentBranch string
		wantBases     []string
		wantRows      []row
	}{
		{
			// Happy path: #1 sits on master, #2 on #1's branch, #3 on #2's.
			name: "chained",
			prs: []ghPR{
				pr(3, "feat/c", "feat/b"),
				pr(1, "feat/a", "master"),
				pr(2, "feat/b", "feat/a"),
			},
			currentBranch: "feat/b",
			wantBases:     []string{"master"},
			wantRows: []row{
				{number: 1, depth: 0},
				{number: 2, depth: 1, current: true},
				{number: 3, depth: 2},
			},
		},
		{
			// Flat repo: every PR is based on the default branch, so each one
			// is a stack of its own.
			name: "flat",
			prs: []ghPR{
				pr(2, "fix/b", "master"),
				pr(1, "fix/a", "master"),
			},
			wantBases: []string{"master", "master"},
			wantRows:  []row{{number: 1}, {number: 2}},
		},
		{
			// A base branch nobody opened a PR for still roots a stack —
			// the chain is simply not visible above that point.
			name:      "base branch has no pull request",
			prs:       []ghPR{pr(7, "feat/child", "feat/untracked")},
			wantBases: []string{"feat/untracked"},
			wantRows:  []row{{number: 7}},
		},
		{
			name:      "no open pull requests",
			prs:       nil,
			wantBases: nil,
			wantRows:  nil,
		},
		{
			// Detached HEAD: git reports no branch, so nothing is "current".
			name:          "detached head marks nothing current",
			prs:           []ghPR{pr(1, "feat/a", "master")},
			currentBranch: "",
			wantBases:     []string{"master"},
			wantRows:      []row{{number: 1, current: false}},
		},
		{
			// A cycle is unreachable from any root. Every PR must still be
			// emitted exactly once, and the walk must terminate.
			name: "cyclic bases",
			prs: []ghPR{
				pr(1, "feat/a", "feat/b"),
				pr(2, "feat/b", "feat/a"),
			},
			wantBases: []string{"feat/b"},
			wantRows:  []row{{number: 1, depth: 0}, {number: 2, depth: 1}},
		},
		{
			// A fork's branch may be named exactly like a local one. It must
			// not adopt the local branch's children, and #3 must stack on
			// the local #1.
			name: "fork branch shares a local branch name",
			prs: []ghPR{
				pr(1, "feat/a", "master"),
				forkPR(2, "stranger", "feat/a", "master"),
				pr(3, "feat/b", "feat/a"),
			},
			currentBranch: "feat/a",
			wantBases:     []string{"master", "master"},
			wantRows: []row{
				{number: 1, depth: 0, current: true},
				{number: 3, depth: 1},
				{number: 2, depth: 0},
			},
		},
		{
			// Two forks can open pull requests from branches with the same
			// name. Neither may be swallowed by the other.
			name:      "duplicate head branch names",
			prs:       []ghPR{pr(1, "patch-1", "master"), pr(2, "patch-1", "master")},
			wantBases: []string{"master", "master"},
			wantRows:  []row{{number: 1}, {number: 2}},
		},
		{
			// A branch based on itself must not become its own child.
			name:      "self-based branch",
			prs:       []ghPR{pr(1, "feat/a", "feat/a")},
			wantBases: []string{"feat/a"},
			wantRows:  []row{{number: 1}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			done := make(chan struct{})
			var stacks []Stack
			go func() {
				stacks = buildStacks(tt.prs, tt.currentBranch)
				close(done)
			}()
			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Fatal("buildStacks did not terminate")
			}

			bases, rows := flatten(stacks)
			if strings.Join(bases, ",") != strings.Join(tt.wantBases, ",") {
				t.Errorf("stack bases = %v, want %v", bases, tt.wantBases)
			}
			if len(rows) != len(tt.wantRows) {
				t.Fatalf("got %d rows %v, want %d %v", len(rows), rows, len(tt.wantRows), tt.wantRows)
			}
			for i, got := range rows {
				if got != tt.wantRows[i] {
					t.Errorf("row %d = %+v, want %+v", i, got, tt.wantRows[i])
				}
			}

			seen := map[int]int{}
			for _, r := range rows {
				seen[r.number]++
			}
			for num, count := range seen {
				if count != 1 {
					t.Errorf("pull request #%d emitted %d times, want exactly once", num, count)
				}
			}
			if len(seen) != len(tt.prs) {
				t.Errorf("emitted %d distinct pull requests, want %d", len(seen), len(tt.prs))
			}
		})
	}
}

func TestForkHeadIsOwnerQualified(t *testing.T) {
	stacks := buildStacks([]ghPR{
		pr(1, "feat/a", "master"),
		forkPR(2, "stranger", "feat/a", "master"),
	}, "feat/a")

	_, rows := flatten(stacks)
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want both pull requests", len(rows))
	}

	var branches []string
	var current []int
	for _, st := range stacks {
		for _, p := range st.PRs {
			branches = append(branches, p.Branch)
			if p.Current {
				current = append(current, p.Number)
			}
		}
	}
	if branches[0] != "feat/a" || branches[1] != "stranger:feat/a" {
		t.Errorf("branches = %v, want the fork's head qualified by owner", branches)
	}
	if len(current) != 1 || current[0] != 1 {
		t.Errorf("pull requests marked current = %v, want only the local #1", current)
	}
}

// A trimmed but shape-accurate `gh pr list --json ...` payload. The tests
// above build ghPR values by hand, which means nothing else in this suite
// would notice a struct tag drifting away from the field gh actually sends.
const ghListSample = `[{
  "number": 7,
  "title": "feat: pr view",
  "headRefName": "feat/pr-view",
  "baseRefName": "master",
  "isDraft": true,
  "reviewDecision": "CHANGES_REQUESTED",
  "mergeable": "CONFLICTING",
  "url": "https://github.com/owner/repo/pull/7",
  "isCrossRepository": true,
  "headRepositoryOwner": {"login": "stranger"},
  "statusCheckRollup": [
    {"__typename": "CheckRun", "status": "COMPLETED", "conclusion": "FAILURE"},
    {"__typename": "StatusContext", "state": "SUCCESS"}
  ]
}]`

func TestGhPayloadDecodesIntoTheFieldsTheViewReads(t *testing.T) {
	var prs []ghPR
	if err := json.Unmarshal([]byte(ghListSample), &prs); err != nil {
		t.Fatalf("decoding a gh payload: %v", err)
	}
	if len(prs) != 1 {
		t.Fatalf("decoded %d pull requests, want 1", len(prs))
	}

	got := toPR(prs[0], 0, "feat/pr-view")
	want := PR{
		Number: 7, Title: "feat: pr view", Branch: "stranger:feat/pr-view",
		Base: "master", Depth: 0, Draft: true, Current: false,
		URL:    "https://github.com/owner/repo/pull/7",
		Checks: "failing", Review: "CHANGES_REQUESTED", Mergeable: "CONFLICTING",
	}
	if got != want {
		t.Errorf("decoded pull request =\n  %+v\nwant\n  %+v", got, want)
	}
}

// Go links the struct tags and the field list gh is asked for by nothing at
// all, so a field can be decoded but never requested — and arrive empty.
func TestPRFieldsRequestsEveryDecodedField(t *testing.T) {
	requested := map[string]bool{}
	for _, name := range strings.Split(prFields, ",") {
		requested[name] = true
	}
	typ := reflect.TypeOf(ghPR{})
	for i := 0; i < typ.NumField(); i++ {
		tag := typ.Field(i).Tag.Get("json")
		if tag == "" || tag == "-" {
			continue
		}
		name := strings.Split(tag, ",")[0]
		if !requested[name] {
			t.Errorf("ghPR decodes %q, but prFields never asks gh for it", name)
		}
	}
}

func TestEmitJSONKeepsTheDocumentedKeys(t *testing.T) {
	var buf bytes.Buffer
	doc := Doc{
		Repo: "owner/repo", DefaultBranch: "master", CurrentBranch: "feat/a",
		GeneratedAt: "2026-08-29T00:00:00Z",
		Stacks: []Stack{{Base: "master", PRs: []PR{{
			Number: 1, Title: "t", Branch: "feat/a", Base: "master",
			URL: "u", Checks: "none", Review: "APPROVED", Mergeable: "MERGEABLE",
			Current: true,
		}}}},
	}
	if err := emit(&buf, doc, true); err != nil {
		t.Fatalf("emit: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(buf.Bytes(), &decoded); err != nil {
		t.Fatalf("--json did not emit JSON: %v\n%s", err, buf.String())
	}
	for _, key := range []string{"repo", "defaultBranch", "currentBranch", "generatedAt", "stacks"} {
		if _, ok := decoded[key]; !ok {
			t.Errorf("top-level key %q missing from --json output", key)
		}
	}

	stacks, _ := decoded["stacks"].([]any)
	if len(stacks) != 1 {
		t.Fatalf("stacks = %v, want one", decoded["stacks"])
	}
	stack, _ := stacks[0].(map[string]any)
	if _, ok := stack["base"]; !ok {
		t.Error(`stack key "base" missing from --json output`)
	}
	rows, _ := stack["prs"].([]any)
	if len(rows) != 1 {
		t.Fatalf("prs = %v, want one", stack["prs"])
	}
	row, _ := rows[0].(map[string]any)
	for _, key := range []string{"number", "title", "branch", "base", "depth", "draft", "current", "url", "checks", "review", "mergeable"} {
		if _, ok := row[key]; !ok {
			t.Errorf("pull request key %q missing from --json output", key)
		}
	}
}

func TestEmitTextIsNotJSON(t *testing.T) {
	var buf bytes.Buffer
	doc := Doc{Repo: "owner/repo", DefaultBranch: "master",
		Stacks: []Stack{{Base: "master", PRs: []PR{{Number: 1, Branch: "feat/a", Checks: "none"}}}}}
	if err := emit(&buf, doc, false); err != nil {
		t.Fatalf("emit: %v", err)
	}
	if !strings.Contains(buf.String(), "#1 feat/a") {
		t.Errorf("text output missing the pull request row:\n%s", buf.String())
	}
	if strings.HasPrefix(strings.TrimSpace(buf.String()), "{") {
		t.Errorf("text mode emitted JSON:\n%s", buf.String())
	}
}

func TestSummarize(t *testing.T) {
	tests := []struct {
		name   string
		checks []check
		want   string
	}{
		{"no checks configured", nil, "none"},
		{"all green", []check{{Conclusion: "SUCCESS"}, {State: "SUCCESS"}}, "passing"},
		{"skipped counts as green", []check{{Conclusion: "SKIPPED"}, {Conclusion: "NEUTRAL"}}, "passing"},
		{"one failure outranks the rest", []check{{Conclusion: "SUCCESS"}, {Conclusion: "FAILURE"}, {Status: "IN_PROGRESS"}}, "failing"},
		{"errored counts as failing", []check{{State: "ERROR"}}, "failing"},
		{"unfinished run has no conclusion yet", []check{{Conclusion: "SUCCESS"}, {Status: "IN_PROGRESS"}}, "pending"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := summarize(tt.checks); got != tt.want {
				t.Errorf("summarize() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRenderTextWithoutPullRequests(t *testing.T) {
	got := renderText(Doc{Repo: "owner/repo", DefaultBranch: "master"})
	if !strings.Contains(got, "No open pull requests.") {
		t.Errorf("rendered output = %q, want it to report no open pull requests", got)
	}
}

func TestRenderTextIndentsByDepth(t *testing.T) {
	got := renderText(Doc{
		Repo: "owner/repo", DefaultBranch: "master",
		Stacks: []Stack{{Base: "master", PRs: []PR{
			{Number: 1, Title: "bottom", Branch: "feat/a", Depth: 0, Checks: "none"},
			{Number: 2, Title: "top", Branch: "feat/b", Depth: 1, Checks: "passing", Current: true, Draft: true},
		}}},
	})
	if !strings.Contains(got, "  #1 feat/a [checks: none]\n") {
		t.Errorf("depth 0 row not indented as expected:\n%s", got)
	}
	if !strings.Contains(got, "    #2 feat/b [checks: passing] (draft) ← you are here\n") {
		t.Errorf("depth 1 row not indented or marked as expected:\n%s", got)
	}
}

func TestCaptureMissingBinaryExplainsHowToInstall(t *testing.T) {
	_, err := capture("gh-that-is-definitely-not-installed")
	if err == nil {
		t.Fatal("expected an error for a binary that is not on PATH")
	}
	if !strings.Contains(err.Error(), "not on your PATH") {
		t.Errorf("error = %q, want it to say the binary is missing", err)
	}
}

func TestCaptureSurfacesStderrAndAuthRemedy(t *testing.T) {
	_, err := capture("sh", "-c", "echo 'gh: To get started with GitHub CLI, please run: gh auth login' >&2; exit 1")
	if err == nil {
		t.Fatal("expected an error when the command exits non-zero")
	}
	msg := err.Error()
	if !strings.Contains(msg, "To get started with GitHub CLI") {
		t.Errorf("error = %q, want it to carry the command's own stderr", msg)
	}
	if !strings.Contains(msg, "fix: gh auth login") {
		t.Errorf("error = %q, want it to name the remedy", msg)
	}
}

func TestCaptureDoesNotMistakeAuthorForAuth(t *testing.T) {
	_, err := capture("sh", "-c", "echo 'no commits found for author octocat' >&2; exit 1")
	if err == nil {
		t.Fatal("expected an error when the command exits non-zero")
	}
	if strings.Contains(err.Error(), "gh auth login") {
		t.Errorf("error = %q, want no auth remedy — \"author\" is not an auth failure", err)
	}
}

func TestRenderTextShowsReviewAndMergeState(t *testing.T) {
	got := renderText(Doc{
		Repo: "owner/repo", DefaultBranch: "master",
		Stacks: []Stack{{Base: "master", PRs: []PR{
			{Number: 1, Branch: "feat/a", Checks: "failing", Review: "CHANGES_REQUESTED", Mergeable: "CONFLICTING"},
			{Number: 2, Branch: "feat/b", Checks: "passing", Review: "APPROVED", Mergeable: "MERGEABLE", Depth: 1},
		}}},
	})
	if !strings.Contains(got, "#1 feat/a [checks: failing] (conflicts) (changes requested)") {
		t.Errorf("conflict and review state missing:\n%s", got)
	}
	if !strings.Contains(got, "#2 feat/b [checks: passing] (approved)") {
		t.Errorf("approval missing:\n%s", got)
	}
}

func TestCaptureNonAuthFailureKeepsStderrWithoutRemedy(t *testing.T) {
	_, err := capture("sh", "-c", "echo 'no git remotes found' >&2; exit 1")
	if err == nil {
		t.Fatal("expected an error when the command exits non-zero")
	}
	if !strings.Contains(err.Error(), "no git remotes found") {
		t.Errorf("error = %q, want the command's own stderr", err)
	}
	if strings.Contains(err.Error(), "gh auth login") {
		t.Errorf("error = %q, want no auth remedy on a non-auth failure", err)
	}
}

func TestBuildStacksIsDeterministic(t *testing.T) {
	prs := []ghPR{pr(4, "d", "master"), pr(2, "b", "master"), pr(3, "c", "b"), pr(1, "a", "master")}
	wantBases, want := flatten(buildStacks(prs, ""))

	// gh returns pull requests in whatever order it likes; every permutation
	// of the same set must produce the same view.
	for _, order := range permutations(prs) {
		bases, got := flatten(buildStacks(order, ""))
		if strings.Join(bases, ",") != strings.Join(wantBases, ",") {
			t.Fatalf("input order changed the stack bases: %v vs %v", bases, wantBases)
		}
		if len(got) != len(want) {
			t.Fatalf("input order changed the row count: got %v, want %v", got, want)
		}
		for j := range want {
			if got[j] != want[j] {
				t.Fatalf("input order changed the output: %v vs %v", got, want)
			}
		}
	}
}

func permutations(prs []ghPR) [][]ghPR {
	if len(prs) <= 1 {
		return [][]ghPR{append([]ghPR(nil), prs...)}
	}
	var out [][]ghPR
	for i := range prs {
		rest := make([]ghPR, 0, len(prs)-1)
		rest = append(rest, prs[:i]...)
		rest = append(rest, prs[i+1:]...)
		for _, tail := range permutations(rest) {
			out = append(out, append([]ghPR{prs[i]}, tail...))
		}
	}
	return out
}

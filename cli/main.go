// Command prancakes prints the current state of this repository's stacked
// pull requests. It reads GitHub through the gh CLI, which already holds the
// user's credentials — this program mints, stores and reads no tokens.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

// The fields gh 2.45 exposes that describe where a pull request sits and what
// state it is in. statusCheckRollup comes back empty on a repo without CI.
const prFields = "number,title,headRefName,baseRefName,isDraft,reviewDecision,mergeable,statusCheckRollup,url,isCrossRepository,headRepositoryOwner"

// gh returns 30 open pull requests unless told otherwise. Ask for far more,
// and say so out loud rather than truncating a stack in silence — a dropped
// pull request would make its children look like the bottom of their stack.
const prLimit = 1000

// ghPR is the slice of `gh pr list --json` output we ask for.
type ghPR struct {
	Number              int     `json:"number"`
	Title               string  `json:"title"`
	HeadRefName         string  `json:"headRefName"`
	BaseRefName         string  `json:"baseRefName"`
	IsDraft             bool    `json:"isDraft"`
	ReviewDecision      string  `json:"reviewDecision"`
	Mergeable           string  `json:"mergeable"`
	URL                 string  `json:"url"`
	StatusCheckRollup   []check `json:"statusCheckRollup"`
	IsCrossRepository   bool    `json:"isCrossRepository"`
	HeadRepositoryOwner struct {
		Login string `json:"login"`
	} `json:"headRepositoryOwner"`
}

// headKey identifies a pull request's head branch. A fork can open a pull
// request from a branch named exactly like one of yours, so cross-repository
// heads are qualified by owner — otherwise a stranger's `feat/a` could parent
// your pull requests, or be mistaken for the branch you are standing on.
func headKey(p ghPR) string {
	if p.IsCrossRepository && p.HeadRepositoryOwner.Login != "" {
		return p.HeadRepositoryOwner.Login + ":" + p.HeadRefName
	}
	return p.HeadRefName
}

// A rollup entry is either a status context (State set) or a check run
// (Status set, Conclusion set only once it has finished).
type check struct {
	State      string `json:"state"`
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
}

// PR is one row of the view. Depth is how far up its stack it sits, so a
// renderer can indent without walking a tree.
type PR struct {
	Number    int    `json:"number"`
	Title     string `json:"title"`
	Branch    string `json:"branch"`
	Base      string `json:"base"`
	Depth     int    `json:"depth"`
	Draft     bool   `json:"draft"`
	Current   bool   `json:"current"`
	URL       string `json:"url"`
	Checks    string `json:"checks"`
	Review    string `json:"review"`
	Mergeable string `json:"mergeable"`
}

// Stack is one chain of pull requests and the branch the whole chain sits on.
type Stack struct {
	Base string `json:"base"`
	PRs  []PR   `json:"prs"`
}

// Doc is the whole view, and the contract the JSON output promises.
type Doc struct {
	Repo          string  `json:"repo"`
	DefaultBranch string  `json:"defaultBranch"`
	CurrentBranch string  `json:"currentBranch"`
	GeneratedAt   string  `json:"generatedAt"`
	Stacks        []Stack `json:"stacks"`
}

func main() {
	if serveRequested(os.Args[1:]) {
		if err := serveCmd(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, "prancakes: "+err.Error())
			os.Exit(1)
		}
		return
	}

	asJSON := flag.Bool("json", false, "emit the stack as JSON instead of text")
	flag.Usage = func() {
		fmt.Fprint(flag.CommandLine.Output(),
			"prancakes — the current state of this repository's stacked pull requests\n\n"+
				"  prancakes            print the stacks\n"+
				"  prancakes --json     the same data as JSON\n"+
				"  prancakes serve      serve the live view on 127.0.0.1 (see `prancakes serve -h`)\n\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	// Saying so beats silently printing the default view when someone types
	// `prancakes sync` and believes it ran.
	if flag.NArg() > 0 {
		hint := "the only subcommand is `prancakes serve`"
		if flag.Arg(0) == "serve" {
			// `prancakes --json serve` lands here; "unknown subcommand" would
			// be a lie, the word is just in the wrong place.
			hint = "put it first: `prancakes serve`"
		}
		fmt.Fprintf(os.Stderr, "prancakes: unexpected argument %q — %s\n", flag.Arg(0), hint)
		os.Exit(2)
	}

	doc, err := collect(context.Background())
	if err != nil {
		fmt.Fprintln(os.Stderr, "prancakes: "+err.Error())
		os.Exit(1)
	}

	if err := emit(os.Stdout, doc, *asJSON); err != nil {
		fmt.Fprintln(os.Stderr, "prancakes: "+err.Error())
		os.Exit(1)
	}
}

// serveRequested decides the dispatch before flag parsing, so `serve` can
// carry flags of its own without colliding with the top-level ones.
func serveRequested(args []string) bool {
	return len(args) > 0 && args[0] == "serve"
}

// emit writes the view. It is separate from main so both branches can be
// tested: a regression that printed text under --json, or dropped a JSON key,
// is otherwise invisible to a test suite.
func emit(w io.Writer, d Doc, asJSON bool) error {
	if asJSON {
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		return enc.Encode(d)
	}
	_, err := io.WriteString(w, renderText(d))
	return err
}

// collect asks gh for the repository and its open pull requests, and git for
// the branch you are standing on.
func collect(ctx context.Context) (Doc, error) {
	repoOut, err := capture(ctx, "gh", "repo", "view", "--json", "nameWithOwner,defaultBranchRef")
	if err != nil {
		return Doc{}, err
	}
	var repo struct {
		NameWithOwner    string `json:"nameWithOwner"`
		DefaultBranchRef struct {
			Name string `json:"name"`
		} `json:"defaultBranchRef"`
	}
	if err := json.Unmarshal(repoOut, &repo); err != nil {
		return Doc{}, fmt.Errorf("reading `gh repo view` output: %w", err)
	}

	prOut, err := capture(ctx, "gh", "pr", "list", "--state", "open", "--limit", strconv.Itoa(prLimit), "--json", prFields)
	if err != nil {
		return Doc{}, err
	}
	var prs []ghPR
	if err := json.Unmarshal(prOut, &prs); err != nil {
		return Doc{}, fmt.Errorf("reading `gh pr list` output: %w", err)
	}
	if len(prs) >= prLimit {
		fmt.Fprintf(os.Stderr, "prancakes: stopped at %d open pull requests; anything past that is missing from this view\n", prLimit)
	}

	// A detached HEAD yields an empty branch name. That is not a failure —
	// it only means no row gets marked as the one you are on.
	branch := ""
	if out, err := capture(ctx, "git", "branch", "--show-current"); err == nil {
		branch = strings.TrimSpace(string(out))
	}

	return Doc{
		Repo:          repo.NameWithOwner,
		DefaultBranch: repo.DefaultBranchRef.Name,
		CurrentBranch: branch,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		Stacks:        buildStacks(prs, branch),
	}, nil
}

// buildStacks groups pull requests into chains. A pull request roots a stack
// when its base branch has no open pull request of its own — which covers
// both "based on master" and "based on a branch nobody opened a PR for".
// Every other pull request hangs off the one whose head branch is its base.
func buildStacks(prs []ghPR, currentBranch string) []Stack {
	byHead := make(map[string]struct{}, len(prs))
	for _, pr := range prs {
		byHead[headKey(pr)] = struct{}{}
	}

	children := map[string][]ghPR{}
	var roots []ghPR
	for _, pr := range prs {
		// A base branch is always in this repository, so it is never
		// owner-qualified — which is exactly why a fork's head cannot parent
		// anything here.
		_, stacked := byHead[pr.BaseRefName]
		if stacked && pr.BaseRefName != headKey(pr) {
			children[pr.BaseRefName] = append(children[pr.BaseRefName], pr)
			continue
		}
		roots = append(roots, pr)
	}
	byNumber(roots)
	for base := range children {
		byNumber(children[base])
	}

	visited := map[int]bool{}
	stacks := []Stack{}
	for _, root := range roots {
		if st := walk(root, children, visited, currentBranch); len(st.PRs) > 0 {
			stacks = append(stacks, st)
		}
	}

	// A cycle (A based on B, B based on A) leaves its members unreachable
	// from any root. Emit them anyway, so every pull request is printed
	// exactly once rather than silently dropped.
	var stranded []ghPR
	for _, pr := range prs {
		if !visited[pr.Number] {
			stranded = append(stranded, pr)
		}
	}
	byNumber(stranded)
	for _, pr := range stranded {
		if st := walk(pr, children, visited, currentBranch); len(st.PRs) > 0 {
			stacks = append(stacks, st)
		}
	}
	return stacks
}

// walk emits root and everything stacked above it, depth-first. visited is
// shared across the whole run, which is what stops a cycle from looping. It is
// keyed by pull request number rather than branch, so two pull requests opened
// from same-named branches on different forks do not swallow each other.
func walk(root ghPR, children map[string][]ghPR, visited map[int]bool, currentBranch string) Stack {
	type frame struct {
		pr    ghPR
		depth int
	}
	st := Stack{Base: root.BaseRefName}
	queue := []frame{{pr: root}}
	for len(queue) > 0 {
		f := queue[0]
		queue = queue[1:]
		if visited[f.pr.Number] {
			continue
		}
		visited[f.pr.Number] = true
		st.PRs = append(st.PRs, toPR(f.pr, f.depth, currentBranch))

		kids := children[headKey(f.pr)]
		next := make([]frame, 0, len(kids)+len(queue))
		for _, kid := range kids {
			next = append(next, frame{pr: kid, depth: f.depth + 1})
		}
		queue = append(next, queue...)
	}
	return st
}

func toPR(p ghPR, depth int, currentBranch string) PR {
	return PR{
		Number:    p.Number,
		Title:     p.Title,
		Branch:    headKey(p),
		Base:      p.BaseRefName,
		Depth:     depth,
		Draft:     p.IsDraft,
		Current:   currentBranch != "" && !p.IsCrossRepository && p.HeadRefName == currentBranch,
		URL:       p.URL,
		Checks:    summarize(p.StatusCheckRollup),
		Review:    p.ReviewDecision,
		Mergeable: p.Mergeable,
	}
}

// summarize reduces a check rollup to one word. Any failure outranks any
// pending, which outranks passing. An empty rollup means nothing ran — which
// is not the same claim as "passing", so it gets its own word.
func summarize(checks []check) string {
	if len(checks) == 0 {
		return "none"
	}
	pending := false
	for _, c := range checks {
		verdict := c.Conclusion
		if verdict == "" {
			verdict = c.State
		}
		switch strings.ToUpper(verdict) {
		case "FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE":
			return "failing"
		case "SUCCESS", "NEUTRAL", "SKIPPED":
		default:
			// Includes a check run still in progress, whose conclusion is
			// not filled in yet.
			pending = true
		}
	}
	if pending {
		return "pending"
	}
	return "passing"
}

func renderText(d Doc) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s — default branch %s\n", d.Repo, d.DefaultBranch)
	if len(d.Stacks) == 0 {
		b.WriteString("\nNo open pull requests.\n")
		return b.String()
	}
	const indent = "  "
	for _, st := range d.Stacks {
		fmt.Fprintf(&b, "\n%s\n", st.Base)
		for _, pr := range st.PRs {
			marks := ""
			if pr.Draft {
				marks += " (draft)"
			}
			if pr.Mergeable == "CONFLICTING" {
				marks += " (conflicts)"
			}
			switch pr.Review {
			case "APPROVED":
				marks += " (approved)"
			case "CHANGES_REQUESTED":
				marks += " (changes requested)"
			}
			if pr.Current {
				marks += " ← you are here"
			}
			row := strings.Repeat(indent, pr.Depth+1)
			fmt.Fprintf(&b, "%s#%d %s [checks: %s]%s\n%s%s\n",
				row, pr.Number, pr.Branch, pr.Checks, marks, row+indent+indent, pr.Title)
		}
	}
	return b.String()
}

func byNumber(prs []ghPR) {
	sort.Slice(prs, func(i, j int) bool { return prs[i].Number < prs[j].Number })
}

// capture runs a command and returns its stdout, turning the two failures a
// user can actually fix — the tool is missing, or gh is not authenticated —
// into messages that say what to do next.
func capture(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	out, err := cmd.Output()
	if err == nil {
		return out, nil
	}
	if errors.Is(err, exec.ErrNotFound) {
		return nil, fmt.Errorf("%s is not on your PATH, and PRancakes needs it — install it: %s", name, installHint(name))
	}

	cmdline := strings.Join(append([]string{name}, args...), " ")
	// A cancelled context means gh hung — say that, rather than reporting
	// whatever truncated noise it left on stderr.
	if ctxErr := ctx.Err(); ctxErr != nil {
		return nil, fmt.Errorf("`%s` did not finish: %w", cmdline, ctxErr)
	}

	msg := strings.TrimSpace(stderr.String())
	if msg == "" {
		msg = err.Error()
	}
	if looksLikeAuth(msg) {
		msg += "\n  fix: gh auth login"
	}
	return nil, fmt.Errorf("`%s` failed: %s", cmdline, msg)
}

func installHint(name string) string {
	switch name {
	case "gh":
		return "https://cli.github.com"
	case "git":
		return "https://git-scm.com/downloads"
	}
	return name
}

// Deliberately narrow: a bare "auth" also matches "author", which appears in
// plenty of git and gh errors that have nothing to do with credentials.
// ponytail: substring sniffing on gh's prose. If gh ever reworks its wording
// this quietly stops offering the remedy — the error itself still surfaces.
// Swap for exit-code or HTTP-status matching if gh exposes one.
func looksLikeAuth(msg string) bool {
	low := strings.ToLower(msg)
	for _, sign := range []string{"gh auth", "not logged in", "authentication", "credentials", "unauthorized"} {
		if strings.Contains(low, sign) {
			return true
		}
	}
	return false
}

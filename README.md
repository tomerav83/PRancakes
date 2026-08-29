# PRancakes
PRancakes is an open-source tool for creating, managing, and synchronizing stacked pull requests on GitHub.

> **Status:** in development, no release yet. The CLI reads the current state of a
> stack; nothing writes to GitHub yet.

## CLI

`cli/` is a Go module with no dependencies. It reads GitHub through the [`gh`
CLI](https://cli.github.com), so it uses the credentials you have already signed
in with — PRancakes handles no tokens of its own.

Needs Go 1.22+ and `gh` 2.45+, already signed in (`gh auth login`).

```bash
cd cli
go run .            # print this repo's open pull requests, grouped into stacks
go run . --json     # the same data as JSON
go test ./...       # unit tests, no network
go build -o prancakes .
```

### The live view

`prancakes serve` starts a local server that queries `gh` on demand and serves
the page from the same origin, so Refresh re-reads GitHub without regenerating
a file or rebuilding anything. There is no polling — the view updates when you
ask it to.

```bash
make                # build the page if it is stale, then serve it
make PORT=9000      # the same, on another port
```

Or run the two steps yourself:

```bash
cd web && npm run build     # once, so there is a page to serve
cd cli && go run . serve    # http://127.0.0.1:8080/stack
```

The page only works under `serve`: it is served by this binary, not by
`npm run dev`, and the copy in the public export has no API behind it.

It binds loopback only — it reports a private repository's state and has no
authentication of its own. `--port` moves it; `--site` points at a different
build of the page.

Run it from inside a GitHub repository. Pull requests are grouped by following
each one's base branch: a pull request opened against a branch that has its own
pull request is stacked on top of it, and the row for the branch you are
currently on is marked.

## Homepage

The marketing site lives in `web/` — Next.js, statically exported.

```bash
cd web
npm install
npm run dev     # http://localhost:3000
npm run build   # static export into web/out
```

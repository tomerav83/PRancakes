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

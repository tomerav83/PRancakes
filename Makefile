# PRancakes — one command to get the live view up:
#
#     make                       serve this repository's stacks
#     make REPO=~/code/thing     serve another repository's stacks
#     make PORT=9000             the same, on another port
#
# REPO is what gh reads the pull requests from — the server runs there, while
# the page it serves comes from this checkout. Both build artifacts are real
# file targets, so make rebuilds them only when their sources changed.

PORT ?= 8080
REPO ?= .
BIN := cli/prancakes
SITE := web/out/stack.html
WEB_SOURCES := $(shell find web/app web/public -type f 2>/dev/null) web/package.json web/next.config.ts
GO_SOURCES := $(shell find cli -name '*.go' 2>/dev/null) cli/go.mod

.DEFAULT_GOAL := serve
.PHONY: serve site test lint clean

# Absolute paths: the server is started from REPO, not from here.
serve: $(SITE) $(BIN)
	cd $(REPO) && $(CURDIR)/$(BIN) serve --port $(PORT) --site $(CURDIR)/web/out

site: $(SITE)

$(BIN): $(GO_SOURCES)
	cd cli && go build -o prancakes .

$(SITE): $(WEB_SOURCES) | web/node_modules
	cd web && npm run build

# Order-only prerequisite: npm decides what is stale inside node_modules, and
# touch keeps make from reinstalling on every run.
web/node_modules: web/package-lock.json
	cd web && npm install
	touch web/node_modules

test:
	cd cli && go test ./...
	cd web && npm test

lint:
	cd cli && go vet ./... && gofmt -l .
	cd web && npm run lint

clean:
	rm -rf web/out web/.next

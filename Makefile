# PRancakes — one command to get the live view up:
#
#     make            build the site if it is stale, then serve it
#     make PORT=9000  the same, on another port
#
# The export is a real build artifact, so make rebuilds it only when something
# under web/ actually changed.

PORT ?= 8080
SITE := web/out/stack.html
WEB_SOURCES := $(shell find web/app web/public -type f 2>/dev/null) web/package.json web/next.config.ts

.DEFAULT_GOAL := serve
.PHONY: serve site test lint clean

serve: $(SITE)
	cd cli && go run . serve --port $(PORT)

site: $(SITE)

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

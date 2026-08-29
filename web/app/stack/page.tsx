"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

// Mirrors the document the CLI emits — see cli/main.go. One shape serves both
// `prancakes --json` and this page.
type PullRequest = {
  number: number;
  title: string;
  branch: string;
  base: string;
  depth: number;
  draft: boolean;
  current: boolean;
  url: string;
  checks: string;
  review: string;
  mergeable: string;
};

type Stack = { base: string; prs: PullRequest[] };

type StackDocument = {
  repo: string;
  defaultBranch: string;
  currentBranch: string;
  generatedAt: string;
  stacks: Stack[];
};

// `unreachable` is the ordinary case of a page opened without the server
// running — it gets instructions, not an error shout.
type Problem = { kind: "unreachable" } | { kind: "error"; message: string };

const ENDPOINT = "/api/stack";
// The server bounds its own gh read; this bounds a connection that is accepted
// and then never answered, which would otherwise disable Refresh forever.
const TIMEOUT_MS = 30_000;
const START_COMMAND = "prancakes serve";

function isStackDocument(value: unknown): value is StackDocument {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Partial<StackDocument>;
  if (typeof doc.repo !== "string" || !Array.isArray(doc.stacks)) return false;
  // Every stack is mapped over on render; one without a prs array would throw
  // mid-render and blank the page instead of reporting a bad document.
  return doc.stacks.every(
    (stack) => typeof stack === "object" && stack !== null && Array.isArray(stack.prs),
  );
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const { error } = body as { error?: unknown };
    if (typeof error === "string" && error.trim() !== "") return error;
  }
  return `The server answered ${status}.`;
}

async function loadStacks(): Promise<StackDocument | Problem> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { kind: "unreachable" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // A static host answers this path with HTML, not JSON — which means the
    // page is open without the server behind it.
    return response.ok
      ? { kind: "error", message: "The server sent something that is not JSON." }
      : { kind: "unreachable" };
  }

  if (!response.ok) return { kind: "error", message: errorMessage(body, response.status) };
  if (!isStackDocument(body)) {
    return { kind: "error", message: "The server sent a document this page does not recognise." };
  }
  return body;
}

function generatedAt(iso: string): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : at.toLocaleTimeString();
}

function badges(pr: PullRequest) {
  const marks: { label: string; tone?: "alert" | "here" }[] = [];
  if (pr.draft) marks.push({ label: "draft" });
  if (pr.checks !== "none") {
    marks.push({ label: `checks ${pr.checks}`, tone: pr.checks === "failing" ? "alert" : undefined });
  }
  if (pr.mergeable === "CONFLICTING") marks.push({ label: "conflicts", tone: "alert" });
  if (pr.review === "APPROVED") marks.push({ label: "approved" });
  if (pr.review === "CHANGES_REQUESTED") marks.push({ label: "changes requested", tone: "alert" });
  if (pr.current) marks.push({ label: "you are here", tone: "here" });
  return marks;
}

export default function StackPage() {
  const [doc, setDoc] = useState<StackDocument | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((result: StackDocument | Problem) => {
    if (isStackDocument(result)) {
      setDoc(result);
      setProblem(null);
    } else {
      // Keep the last good view. Losing the stack because one query failed is
      // worse than showing it with the failure reported beside it.
      setProblem(result);
    }
    setLoading(false);
  }, []);

  // Reads can resolve out of order — a slow first one must not overwrite the
  // result of a refresh the user asked for afterwards.
  const latest = useRef(0);
  const read = useCallback(async () => {
    const ticket = latest.current + 1;
    latest.current = ticket;
    const result = await loadStacks();
    if (ticket === latest.current) apply(result);
  }, [apply]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await read();
  }, [read]);

  // The first read is awaited before anything is set, so the effect body
  // itself never triggers a synchronous render.
  useEffect(() => {
    void read();
  }, [read]);

  return (
    <>
      <header className="topbar">
        <div className="shell topbar__inner">
          <span className="wordmark">
            <span>PR</span>ancakes
          </span>
          <Link className="topbar__link" href="/">
            Home
          </Link>
        </div>
      </header>

      <main className="shell live" aria-busy={loading}>
        <div className="live__head">
          <div>
            <p className="eyebrow">Local view</p>
            <h1 className="live__title">{doc ? doc.repo : "Your stacks"}</h1>
            {doc && (
              <p className="live__meta" aria-live="polite">
                on <code>{doc.currentBranch || "a detached HEAD"}</code> · default{" "}
                <code>{doc.defaultBranch}</code>
                {generatedAt(doc.generatedAt) && <> · read at {generatedAt(doc.generatedAt)}</>}
                {/* A kept view after a failed refresh is not the current
                    state, and must not be presented as if it were. */}
                {problem && <> · not current, the last refresh failed</>}
              </p>
            )}
          </div>
          <button className="btn btn--primary" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Reading…" : "Refresh"}
          </button>
        </div>

        {problem && (
          <div className="card live__problem" role="alert">
            {problem.kind === "unreachable" ? (
              <>
                <h2 className="card__title">Nothing is serving this page</h2>
                <p className="card__body">
                  Start the local server from inside your repository, then reload:
                </p>
                <p className="command__text">
                  <span className="command__prompt">$</span> {START_COMMAND}
                </p>
              </>
            ) : (
              <>
                <h2 className="card__title">The server could not read your stack</h2>
                <p className="card__body live__error">{problem.message}</p>
              </>
            )}
          </div>
        )}

        {doc && doc.stacks.length === 0 && !problem && (
          <div className="card">
            <h2 className="card__title">No open pull requests</h2>
            <p className="card__body">
              Nothing is stacked in {doc.repo} right now. Open one and hit refresh.
            </p>
          </div>
        )}

        {doc?.stacks.map((stack, index) => (
          <section
            className="live__stack"
            key={`${stack.base}-${index}`}
            aria-labelledby={`stack-base-${index}`}
          >
            <p className="stack__base" id={`stack-base-${index}`}>
              {stack.base}
            </p>
            {/* role="list" survives `list-style: none`, which strips list
                semantics in Safari. A screen reader otherwise reaches these
                rows with no idea which branch they sit on. */}
            <ul className="stack__list" role="list" aria-labelledby={`stack-base-${index}`}>
              {stack.prs.map((pr) => (
                <li
                  className="pr pr--live"
                  key={pr.number}
                  style={{ "--depth": pr.depth } as CSSProperties}
                >
                  <span className="pr__num">#{pr.number}</span>
                  <a className="pr__branch" href={pr.url}>
                    {pr.branch}
                  </a>
                  <span className="pr__title">{pr.title}</span>
                  <span className="pr__base">onto {pr.base}</span>
                  {badges(pr).map((mark) => (
                    <span
                      className={`pr__state${mark.tone ? ` pr__state--${mark.tone}` : ""}`}
                      key={mark.label}
                    >
                      {mark.label}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {!doc && !problem && <p className="live__meta">Reading your stacks…</p>}
      </main>
    </>
  );
}

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import StackPage from "./page";

// next/link needs an app-router context that a bare render has no reason to
// provide; the page only uses it as an anchor.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

const twoDeep = {
  repo: "owner/repo",
  defaultBranch: "master",
  currentBranch: "feat/b",
  generatedAt: "2026-08-29T12:00:00Z",
  stacks: [
    {
      base: "master",
      prs: [
        {
          number: 1, title: "the bottom one", branch: "feat/a", base: "master",
          depth: 0, draft: false, current: false, url: "https://example.test/1",
          checks: "passing", review: "", mergeable: "MERGEABLE",
        },
        {
          number: 2, title: "the top one", branch: "feat/b", base: "feat/a",
          depth: 1, draft: true, current: true, url: "https://example.test/2",
          checks: "failing", review: "CHANGES_REQUESTED", mergeable: "CONFLICTING",
        },
      ],
    },
  ],
};

function answer(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function nonJSON(status = 200): Response {
  return {
    ok: status < 400,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token <");
    },
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("renders a stack, indenting each row by its depth", async () => {
  fetchMock.mockResolvedValue(answer(twoDeep));
  const { container } = render(<StackPage />);

  expect(await screen.findByText("#1")).toBeDefined();
  expect(screen.getByText("feat/a")).toBeDefined();
  expect(screen.getByText("the top one")).toBeDefined();
  expect(screen.getByText("onto feat/a")).toBeDefined();

  const rows = container.querySelectorAll("li.pr--live");
  expect(rows).toHaveLength(2);
  expect(rows[0].getAttribute("style")).toContain("--depth: 0");
  // The child sits one level in; without this the stack reads as flat.
  expect(rows[1].getAttribute("style")).toContain("--depth: 1");
});

test("marks the current branch and the states worth acting on", async () => {
  fetchMock.mockResolvedValue(answer(twoDeep));
  render(<StackPage />);

  expect(await screen.findByText("you are here")).toBeDefined();
  expect(screen.getByText("draft")).toBeDefined();
  expect(screen.getByText("checks failing")).toBeDefined();
  expect(screen.getByText("conflicts")).toBeDefined();
  expect(screen.getByText("changes requested")).toBeDefined();
  // A clean row must not be decorated with state it does not have.
  expect(screen.queryByText("approved")).toBeNull();
});

test("says so when the repository has no open pull requests", async () => {
  fetchMock.mockResolvedValue(answer({ ...twoDeep, stacks: [] }));
  render(<StackPage />);

  expect(await screen.findByText("No open pull requests")).toBeDefined();
});

test("tells the user how to start the server when nothing answers", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<StackPage />);

  expect(await screen.findByText("Nothing is serving this page")).toBeDefined();
  expect(screen.getByText(/prancakes serve/)).toBeDefined();
});

test("treats an HTML answer as nothing serving the API", async () => {
  // A static host answers /api/stack with its 404 page, not with JSON.
  fetchMock.mockResolvedValue(nonJSON(404));
  render(<StackPage />);

  expect(await screen.findByText("Nothing is serving this page")).toBeDefined();
});

test("shows gh's own message when the server cannot read the stack", async () => {
  fetchMock.mockResolvedValue(
    answer({ error: "`gh pr list` failed: not logged in\n  fix: gh auth login" }, 500),
  );
  render(<StackPage />);

  expect(await screen.findByText(/gh auth login/)).toBeDefined();
});

test("refresh re-queries without losing the stack when the new read fails", async () => {
  fetchMock.mockResolvedValueOnce(answer(twoDeep));
  render(<StackPage />);
  expect(await screen.findByText("#1")).toBeDefined();

  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  await waitFor(() => expect(screen.getByText("Nothing is serving this page")).toBeDefined());
  expect(fetchMock).toHaveBeenCalledTimes(2);
  // The last good view survives a failed refresh — losing it would be worse
  // than showing it with the failure reported beside it.
  expect(screen.getByText("#1")).toBeDefined();
  expect(screen.getByText("feat/a")).toBeDefined();
});

test("rejects a document that is not the shape the CLI emits", async () => {
  fetchMock.mockResolvedValue(answer({ repo: "owner/repo", stacks: "not an array" }));
  render(<StackPage />);

  expect(await screen.findByText(/does not recognise/)).toBeDefined();
});

test("rejects a stack with no rows rather than throwing mid-render", async () => {
  // stack.prs.map() on this would blank the page instead of reporting it.
  fetchMock.mockResolvedValue(answer({ ...twoDeep, stacks: [{ base: "master" }] }));
  render(<StackPage />);

  expect(await screen.findByText(/does not recognise/)).toBeDefined();
});

test("says the kept view is out of date after a failed refresh", async () => {
  fetchMock.mockResolvedValueOnce(answer(twoDeep));
  render(<StackPage />);
  expect(await screen.findByText("#1")).toBeDefined();
  expect(screen.queryByText(/not current/)).toBeNull();

  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  // The rows survive, but they must not read as the current state.
  await waitFor(() => expect(screen.getByText(/not current/)).toBeDefined());
  expect(screen.getByText("#1")).toBeDefined();
});

test("cannot start a second read while one is still in flight", async () => {
  let release: (r: Response) => void = () => {};
  fetchMock.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      release = resolve;
    }),
  );
  render(<StackPage />);

  // While a read is outstanding the control reads "Reading…" and is disabled,
  // which is what keeps two reads from overlapping and landing out of order.
  const button = screen.getByRole("button", { name: "Reading…" });
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  release(answer(twoDeep));
  expect(await screen.findByText("#1")).toBeDefined();
  expect(screen.getByRole("button", { name: "Refresh" }).hasAttribute("disabled")).toBe(false);
});

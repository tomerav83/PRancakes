import CopyCommand from "./CopyCommand";

const REPO = "https://github.com/tomerav83/PRancakes";

// Top of the stack first, so DOM order matches reading order. Each entry is
// opened against the branch in the row below it.
const STACK = [
  { num: "#4", branch: "feat/homepage", base: "feat/api" },
  { num: "#3", branch: "feat/api", base: "feat/db" },
  { num: "#2", branch: "feat/db", base: "chore/setup" },
  { num: "#1", branch: "chore/setup", base: "main" },
];

const ROADMAP = [
  {
    title: "Sync the whole stack",
    body: "One command rebases the bottom of the chain and replays every branch above it, force-pushing with lease so nobody loses work.",
  },
  {
    title: "Self-describing pull requests",
    body: "Each pull request body carries a live map of the stack, so a reviewer opening #3 can see what it sits on and what is queued behind it.",
  },
  {
    title: "Your gh, your auth",
    body: "PRancakes shells out to the GitHub CLI you have already signed in to. No new tokens to mint, no OAuth app to install.",
  },
];

// Built for the full homepage, parked while the landing page is just the
// header and the mascot. Rendered by nothing today — kept so this markup and
// the styles it uses in globals.css do not have to be rebuilt later.
export default function Sections() {
  return (
    <>
      <main>
        <section className="hero">
          <div className="shell hero__inner">
            <div>
              <p className="status">In development — no release yet</p>
              <h1 className="hero__title">
                Stack pull requests. <em>Skip the rebase tax.</em>
              </h1>
              <p className="hero__lede">
                A chain of dependent pull requests should not cost you an
                afternoon of rebasing every time the bottom one changes.
              </p>
              <CopyCommand command="gh repo clone tomerav83/PRancakes" />
              <div className="hero__actions">
                <a className="btn btn--primary" href={REPO}>
                  Read the source
                </a>
                <a className="btn btn--ghost" href="#stack">
                  See how stacking works
                </a>
              </div>
            </div>
            <div className="hero__art">
              {/* A static SVG on a static export: next/image would add a
                  component and optimize nothing (images.unoptimized). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mascot.svg"
                alt="The PRancakes mascot: a stack of pancakes in a blue cape, flying with one fist raised"
                width={400}
                height={340}
              />
            </div>
          </div>
        </section>

        <section className="stack" id="stack" tabIndex={-1}>
          <div className="shell stack__inner">
            <div className="stack__head">
              <p className="eyebrow">The shape of the problem</p>
              <h2 className="stack__title">Four pull requests, one chain</h2>
              <p className="stack__lede">
                Each branch is opened against the branch below it, not against
                main. Rebase anywhere in the chain and every pull request
                stacked above it has to move too.
              </p>
              <p className="stack__hint">
                That walk — rebase, replay, force-push with lease, repoint every
                base branch on GitHub — is the job PRancakes is being built to
                do.
              </p>
            </div>

            <div>
              {/* role="list" survives `list-style: none`, which strips list
                  semantics in Safari. */}
              <ul className="stack__list" role="list">
                {STACK.map((pr) => (
                  <li className="pr" key={pr.num}>
                    <span className="pr__num">{pr.num}</span>
                    <span className="pr__branch">{pr.branch}</span>
                    <span className="pr__base">onto {pr.base}</span>
                    {/* Pointer-only flourish; the prose above carries the
                        same fact, so it stays out of the accessibility tree
                        rather than being read on every row at once. */}
                    <span className="pr__flag" aria-hidden="true">
                      needs rebase
                    </span>
                  </li>
                ))}
              </ul>
              <p className="stack__base">main</p>
            </div>
          </div>
        </section>

        <section className="roadmap">
          <div className="shell">
            <p className="eyebrow">Roadmap</p>
            <h2 className="roadmap__title">What we&rsquo;re building</h2>
            <div className="roadmap__grid">
              {ROADMAP.map((item) => (
                <article className="card" key={item.title}>
                  <h3 className="card__title">{item.title}</h3>
                  <p className="card__body">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer__inner">
          <span>
            Open source under{" "}
            <a href={`${REPO}/blob/HEAD/LICENSE`}>Apache-2.0</a>
          </span>
          <span className="footer__note">
            Not affiliated with GitHub. Pancakes not included.
          </span>
          <a href={REPO}>github.com/tomerav83/PRancakes</a>
        </div>
      </footer>
    </>
  );
}

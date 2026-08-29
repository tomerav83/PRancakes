const REPO = "https://github.com/tomerav83/PRancakes";

// The rest of the homepage — hero, stack diagram, roadmap, footer — lives in
// sections.tsx, built and kept but not shown while the page is just a header.
export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="shell topbar__inner">
          <span className="wordmark">
            <span>PR</span>ancakes
          </span>
          {/* A plain anchor, like the GitHub link beside it: next/link would
              prefetch the /stack payload on a page most visitors never leave. */}
          <nav className="topbar__nav" aria-label="Site">
            <a className="topbar__link" href="/stack">
              Stacks
            </a>
            <a className="topbar__link" href={REPO}>
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="shell landing">
        {/* A static SVG on a static export: next/image would add a component
            and optimize nothing (images.unoptimized). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="landing__mascot"
          src="/mascot.svg"
          alt="The PRancakes mascot: a stack of pancakes in a blue cape, flying with one fist raised"
          width={400}
          height={340}
        />
      </main>
    </>
  );
}

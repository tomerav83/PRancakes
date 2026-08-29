import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `out/` is plain files, servable by any static host at a
  // domain root. Asset URLs are root-absolute (`/_next/…`, `/mascot.svg`), so
  // a subpath deploy — a GitHub Pages *project* site, say — additionally needs
  // `basePath`/`assetPrefix` set to that subpath, plus an `out/.nojekyll`.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;

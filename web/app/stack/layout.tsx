import type { Metadata } from "next";
import type { ReactNode } from "react";

// This route ships inside the public static export, where there is no server
// to answer /api/stack. It is a local tool's screen, not a page for the web.
export const metadata: Metadata = {
  title: "Your stacks — PRancakes",
  description: "The live view of this repository's stacked pull requests, served by `prancakes serve`.",
  robots: { index: false, follow: false },
};

export default function StackLayout({ children }: { children: ReactNode }) {
  return children;
}

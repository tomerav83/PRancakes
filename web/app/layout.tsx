import type { Metadata } from "next";
import { Fraunces, Karla, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Fraunces carries the brand: a chunky soft serif whose SOFT/WONK axes echo
// the mascot's hand-drawn line. Karla sets the text, JetBrains Mono the
// branch names and commands — the vocabulary the reader already works in.
const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-display",
  display: "swap",
});

const body = Karla({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PRancakes — stacked pull requests on GitHub",
  description:
    "PRancakes keeps a chain of dependent pull requests in sync on GitHub. Rebase the bottom of the stack and every pull request above it follows.",
  openGraph: {
    title: "PRancakes — stacked pull requests on GitHub",
    description:
      "Keep a chain of dependent pull requests in sync. Open source, Apache-2.0.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}

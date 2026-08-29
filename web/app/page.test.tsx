import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

// The landing page is markup, but the /stack link is the only way into the
// live view — a regression here is invisible until someone looks for it.
test("the topbar links to the stack view", () => {
  render(<Home />);
  expect(screen.getByRole("link", { name: "Stacks" }).getAttribute("href")).toBe("/stack");
});

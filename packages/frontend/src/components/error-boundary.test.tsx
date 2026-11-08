/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { ErrorBoundary } from "./error-boundary";

function Boom(): never {
  throw new Error("test render failure");
}

describe("ErrorBoundary", () => {
  it("renders the localized fallback instead of a blank screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "Couldn't load this page." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

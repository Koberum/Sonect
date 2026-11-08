/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "@/test/render";
import NotFound from "./NotFound";

describe("NotFound", () => {
  it("renders a localized 404 with a link back to Discover", () => {
    renderWithProviders(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to Discover" }),
    ).toHaveAttribute("href", "/discover");
  });
});

/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { MediaCard } from "./media-card";

describe("MediaCard", () => {
  it("does not activate the card when an action is used", async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <MediaCard
        artwork={{ kind: "single", alt: "Cover" }}
        title="Test album"
        onActivate={onActivate}
        actions={<button type="button">Action</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Action" }));

    expect(onActivate).not.toHaveBeenCalled();
  });

  it("activates from its own button", async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <MediaCard
        artwork={{ kind: "single", alt: "Cover" }}
        title="Test album"
        onActivate={onActivate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Test album" }));

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("activates with the keyboard", async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <MediaCard
        artwork={{ kind: "single", alt: "Cover" }}
        title="Test album"
        onActivate={onActivate}
      />,
    );

    screen.getByRole("button", { name: "Test album" }).focus();
    await user.keyboard("{Enter}");

    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});

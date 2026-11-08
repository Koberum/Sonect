/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ profile: { id: "profile-a" } }),
}));

import { CreatePlaylistDialog } from "./create-playlist-dialog";

describe("CreatePlaylistDialog", () => {
  it("exposes a description and a labelled name field", () => {
    renderWithProviders(<CreatePlaylistDialog open onOpenChange={() => {}} />);

    expect(
      screen.getByText("Create a playlist for this profile."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });
});

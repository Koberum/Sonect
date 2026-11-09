/** @vitest-environment jsdom */
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const state = vi.hoisted(() => ({
  finePointer: true,
  auth: {
    profile: {
      id: "p1",
      name: "Lorenzo",
      avatarColor: "#f97316",
      role: "admin" as "admin" | "user",
    },
    isAdmin: true,
    logout: vi.fn(),
  },
  candidates: [
    {
      id: "p1",
      name: "Lorenzo",
      avatarColor: "#f97316",
      role: "admin" as const,
      createdAt: 1,
    },
    {
      id: "p2",
      name: "Vane",
      avatarColor: "#22c55e",
      role: "user" as const,
      createdAt: 2,
    },
  ],
}));

vi.mock("react-responsive", () => ({
  useMediaQuery: () => state.finePointer,
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => state.auth,
}));

vi.mock("./queries", () => ({
  profileQueries: {
    list: () => ({
      queryKey: ["profiles", "admin"],
      queryFn: () => Promise.resolve(state.candidates),
    }),
  },
}));

vi.mock("@/features/auth/queries", () => ({
  authQueries: {
    profiles: () => ({
      queryKey: ["profiles", "public"],
      queryFn: () => Promise.resolve(state.candidates),
    }),
  },
}));

vi.mock("./components/create-profile-form", () => ({
  CreateProfileForm: () => <div>create-form</div>,
}));

vi.mock("./components/switch-profile-dialog", () => ({
  SwitchProfileDialog: ({ target }: { target: { name: string } | null }) =>
    target ? <div>switch-dialog:{target.name}</div> : null,
}));

vi.mock("./components/change-password-dialog", () => ({
  ChangePasswordDialog: ({ open }: { open: boolean }) =>
    open ? <div>password-dialog</div> : null,
}));

vi.mock("./components/edit-profile-dialog", () => ({
  EditProfileDialog: ({ profile }: { profile: { name: string } | null }) =>
    profile ? <div>edit-dialog:{profile.name}</div> : null,
}));

import { ProfileSwitcher } from "./profile-switcher";

function renderSwitcher() {
  return renderWithProviders(<ProfileSwitcher />);
}

function openSwitcher() {
  fireEvent.click(screen.getByRole("button", { name: "Switch profile" }));
}

describe("ProfileSwitcher", () => {
  beforeEach(() => {
    state.finePointer = true;
    state.auth.isAdmin = true;
    state.auth.profile = {
      id: "p1",
      name: "Lorenzo",
      avatarColor: "#f97316",
      role: "admin",
    };
    state.candidates = [
      {
        id: "p1",
        name: "Lorenzo",
        avatarColor: "#f97316",
        role: "admin",
        createdAt: 1,
      },
      {
        id: "p2",
        name: "Vane",
        avatarColor: "#22c55e",
        role: "user",
        createdAt: 2,
      },
    ];
    vi.clearAllMocks();
  });

  it("opens on hover for fine pointers and waits before closing", () => {
    vi.useFakeTimers();
    try {
      renderSwitcher();
      const trigger = screen.getByRole("button", { name: "Switch profile" });

      fireEvent.mouseEnter(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(
        screen.getByRole("dialog", { name: "Switch profile" }),
      ).toBeInTheDocument();

      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(299));
      expect(
        screen.getByRole("dialog", { name: "Switch profile" }),
      ).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));
      expect(
        screen.queryByRole("dialog", { name: "Switch profile" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not open on hover for coarse pointers but opens on tap", () => {
    state.finePointer = false;
    renderSwitcher();
    const trigger = screen.getByRole("button", { name: "Switch profile" });

    fireEvent.mouseEnter(trigger);
    expect(
      screen.queryByRole("dialog", { name: "Switch profile" }),
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Switch profile" }),
    ).toBeInTheDocument();
  });

  it("marks the current profile and switches to another one", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    openSwitcher();

    const current = (await screen.findByText("Lorenzo")).closest("button");
    expect(current).toBeDisabled();
    expect(current).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByText("Vane"));
    expect(await screen.findByText("switch-dialog:Vane")).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Switch profile" }),
    ).not.toBeInTheDocument();
  });

  it("opens the edit dialog from the hover-revealed row action", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    openSwitcher();

    await screen.findByText("Vane");
    await user.click(
      screen.getByRole("button", { name: "Edit profile: Vane" }),
    );
    expect(await screen.findByText("edit-dialog:Vane")).toBeInTheDocument();
  });

  it("opens the create profile dialog for admins", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    openSwitcher();

    await user.click(screen.getByRole("button", { name: "Add profile" }));
    expect(await screen.findByText("create-form")).toBeInTheDocument();
  });

  it("opens the change password dialog and closes the popover", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    openSwitcher();

    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("password-dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Switch profile" }),
    ).not.toBeInTheDocument();
  });

  it("logs out when the logout action is used", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    openSwitcher();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(state.auth.logout).toHaveBeenCalledTimes(1);
  });

  it("hides admin actions for non-admin profiles", async () => {
    state.auth.isAdmin = false;
    state.auth.profile = {
      id: "p2",
      name: "Vane",
      avatarColor: "#22c55e",
      role: "user",
    };
    renderSwitcher();
    openSwitcher();

    expect(
      screen.queryByRole("button", { name: "Add profile" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit profile/ }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Vane")).toBeInTheDocument();
  });
});

/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { renderWithProviders } from "@/test/render";
import { THEME_TEMPLATE_STORAGE_KEY } from "@/themes";
import { ThemeTemplatePicker } from "./theme-template-picker";

function renderPicker() {
  return renderWithProviders(
    <ThemeProvider defaultTheme="light">
      <ThemeTemplatePicker />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeTemplatePicker", () => {
  it("renders one option per template", () => {
    renderPicker();

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Sonect" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Graphite" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ocean" })).toBeInTheDocument();
  });

  it("selects a template and persists it", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("radio", { name: "Ocean" }));

    expect(screen.getByRole("radio", { name: "Ocean" })).toBeChecked();
    expect(localStorage.getItem(THEME_TEMPLATE_STORAGE_KEY)).toBe("ocean");
    expect(document.documentElement.dataset.theme).toBe("ocean");
  });

  it("scopes both preview halves to the card template", () => {
    renderPicker();

    const card = screen.getByRole("radio", {
      name: "Graphite",
    }).nextElementSibling;

    expect(card).not.toBeNull();
    expect(card?.querySelectorAll('[data-theme="graphite"]')).toHaveLength(2);
    expect(card?.querySelectorAll('[data-theme="graphite"].dark')).toHaveLength(
      1,
    );
  });
});

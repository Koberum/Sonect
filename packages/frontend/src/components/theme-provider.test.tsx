/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME_TEMPLATE, THEME_TEMPLATE_STORAGE_KEY } from "@/themes";
import { ThemeProvider, useTheme } from "./theme-provider";

function Probe() {
  const { theme, setTheme, template, setTemplate } = useTheme();

  return (
    <div>
      <span data-testid="mode">{theme}</span>
      <span data-testid="template">{template}</span>
      <button onClick={() => setTheme("light")}>set light</button>
      <button onClick={() => setTemplate("ocean")}>set ocean</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Probe />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeProvider", () => {
  it("defaults to dark mode and the Sonect template", () => {
    renderProvider();

    expect(screen.getByTestId("template").textContent).toBe(
      DEFAULT_THEME_TEMPLATE,
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_TEMPLATE);
  });

  it("reads stored mode and template", () => {
    localStorage.setItem("vite-ui-theme", "light");
    localStorage.setItem(THEME_TEMPLATE_STORAGE_KEY, "graphite");

    renderProvider();

    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement.dataset.theme).toBe("graphite");
  });

  it("ignores an unknown stored template", () => {
    localStorage.setItem(THEME_TEMPLATE_STORAGE_KEY, "neon");

    renderProvider();

    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_TEMPLATE);
  });

  it("persists template changes and applies them to the document", async () => {
    const user = userEvent.setup();
    renderProvider();

    await user.click(screen.getByRole("button", { name: "set ocean" }));

    expect(localStorage.getItem(THEME_TEMPLATE_STORAGE_KEY)).toBe("ocean");
    expect(document.documentElement.dataset.theme).toBe("ocean");
    expect(screen.getByTestId("template").textContent).toBe("ocean");
  });

  it("keeps applying the mode class", async () => {
    const user = userEvent.setup();
    renderProvider();

    await user.click(screen.getByRole("button", { name: "set light" }));

    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });
});

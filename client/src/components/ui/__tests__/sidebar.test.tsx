import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";

const SidebarState = () => {
  const { state, toggleSidebar } = useSidebar();
  return (
    <div>
      <span data-testid="sidebar-state">{state}</span>
      <button type="button" onClick={toggleSidebar}>
        Toggle
      </button>
    </div>
  );
};

describe("SidebarProvider", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("toggles the desktop sidebar and persists the cookie", () => {
    render(
      <SidebarProvider>
        <SidebarState />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    expect(document.cookie).toContain("sidebar_state=false");
  });

  it("toggles the sidebar with the keyboard shortcut", () => {
    render(
      <SidebarProvider>
        <SidebarState />
      </SidebarProvider>,
    );

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
  });
});

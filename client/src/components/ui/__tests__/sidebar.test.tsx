import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
  const cookieStoreSet = vi.fn().mockResolvedValue(undefined);

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

  beforeEach(() => {
    cookieStoreSet.mockClear();
    Object.defineProperty(window, "cookieStore", {
      writable: true,
      value: {
        set: cookieStoreSet,
      },
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
    expect(cookieStoreSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "sidebar_state",
        value: "false",
        path: "/",
        expires: expect.any(Date),
      }),
    );
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

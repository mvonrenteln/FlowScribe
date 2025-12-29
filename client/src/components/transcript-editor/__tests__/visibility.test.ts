import { describe, expect, it, vi } from "vitest";
import { isElementVisible } from "../visibility";

describe("isElementVisible", () => {
  it("returns false if target or container is missing", () => {
    expect(isElementVisible(null, null)).toBe(false);
  });

  it("returns false if height is 0", () => {
    const target = document.createElement("div");
    const container = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.appendChild(container);
    container.appendChild(target);

    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ height: 0 } as DOMRect);
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ height: 100 } as DOMRect);

    expect(isElementVisible(target, container)).toBe(false);
  });

  it("returns true if mostly visible", () => {
    const target = document.createElement("div");
    const container = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.appendChild(container);
    container.appendChild(target);

    // Viewport 0 to 100
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 100,
      height: 100,
    } as DOMRect);

    // Target 30 to 70 (well within 20 to 80 with threshold 20)
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      top: 30,
      bottom: 70,
      height: 40,
    } as DOMRect);

    expect(isElementVisible(target, container)).toBe(true);
  });

  it("returns false if out of view (below)", () => {
    const target = document.createElement("div");
    const container = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.appendChild(container);
    container.appendChild(target);

    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 100,
      height: 100,
    } as DOMRect);

    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      top: 150,
      bottom: 200,
      height: 50,
    } as DOMRect);

    expect(isElementVisible(target, container)).toBe(false);
  });

  it("returns true if it fills the viewport", () => {
    const target = document.createElement("div");
    const container = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.appendChild(container);
    container.appendChild(target);

    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 100,
      height: 100,
    } as DOMRect);

    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      top: -50,
      bottom: 150,
      height: 200,
    } as DOMRect);

    expect(isElementVisible(target, container)).toBe(true);
  });
});

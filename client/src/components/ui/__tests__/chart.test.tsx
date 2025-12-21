import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type ChartConfig, ChartStyle } from "@/components/ui/chart";

describe("ChartStyle", () => {
  it("renders a style tag with theme colors", () => {
    const config: ChartConfig = {
      visits: { color: "#ff0000" },
      conversions: {
        theme: {
          light: "#00ff00",
          dark: "#0000ff",
        },
      },
    };

    const { container } = render(<ChartStyle id="test-chart" config={config} />);
    const styleTag = container.querySelector("style");

    expect(styleTag).not.toBeNull();
    expect(styleTag?.textContent).toContain("[data-chart=test-chart]");
    expect(styleTag?.textContent).toContain("--color-visits: #ff0000;");
    expect(styleTag?.textContent).toContain(".dark [data-chart=test-chart]");
    expect(styleTag?.textContent).toContain("--color-conversions: #0000ff;");
  });

  it("returns null when there are no themed colors", () => {
    const { container } = render(<ChartStyle id="empty-chart" config={{} as ChartConfig} />);

    expect(container.firstChild).toBeNull();
  });
});

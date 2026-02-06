import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AIBatchControlSection } from "../AIBatchControlSection";
import { renderWithI18n } from "./testUtils";

describe("AIBatchControlSection", () => {
  it("renders start action when idle", async () => {
    const user = userEvent.setup();
    const handleStart = vi.fn();

    renderWithI18n(
      <AIBatchControlSection
        isProcessing={false}
        processedCount={0}
        totalToProcess={0}
        startAction={{
          label: "Start Batch",
          icon: <span data-testid="start-icon" />,
          onClick: handleStart,
        }}
        stopAction={{
          label: "Stop",
          icon: <span data-testid="stop-icon" />,
          onClick: vi.fn(),
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /start batch/i }));
    expect(handleStart).toHaveBeenCalled();
  });

  it("renders stop action and progress when processing", () => {
    renderWithI18n(
      <AIBatchControlSection
        isProcessing={true}
        processedCount={3}
        totalToProcess={10}
        startAction={{
          label: "Start Batch",
          icon: <span data-testid="start-icon" />,
          onClick: vi.fn(),
        }}
        stopAction={{
          label: "Stop",
          icon: <span data-testid="stop-icon" />,
          onClick: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText(/3 \/ 10 segments/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });
});

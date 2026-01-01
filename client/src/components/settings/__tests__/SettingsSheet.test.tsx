/**
 * Settings Sheet Component Tests
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsButton, SettingsSheet } from "../SettingsSheet";

// Mock lazy-loaded components
vi.mock("../sections/AIServerSettings", () => ({
  AIServerSettings: () => <div data-testid="ai-server-settings">AI Server Settings Content</div>,
}));

vi.mock("../sections/AITemplateSettings", () => ({
  AITemplateSettings: () => (
    <div data-testid="ai-template-settings">AI Template Settings Content</div>
  ),
}));

vi.mock("../sections/AppearanceSettings", () => ({
  AppearanceSettings: () => (
    <div data-testid="appearance-settings">Appearance Settings Content</div>
  ),
}));

describe("SettingsSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button when showTrigger is true", () => {
    render(<SettingsSheet showTrigger={true} />);
    expect(screen.getByTestId("button-settings")).toBeInTheDocument();
  });

  it("does not render trigger button when showTrigger is false", () => {
    render(<SettingsSheet showTrigger={false} />);
    expect(screen.queryByTestId("button-settings")).not.toBeInTheDocument();
  });

  it("opens sheet when trigger is clicked", async () => {
    render(<SettingsSheet showTrigger={true} />);

    fireEvent.click(screen.getByTestId("button-settings"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("shows Settings title when open", async () => {
    render(<SettingsSheet open={true} onOpenChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("renders navigation items", async () => {
    render(<SettingsSheet open={true} onOpenChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("settings-nav-ai-server")).toBeInTheDocument();
      expect(screen.getByTestId("settings-nav-ai-prompts")).toBeInTheDocument();
      expect(screen.getByTestId("settings-nav-appearance")).toBeInTheDocument();
    });
  });

  it("loads AI Server settings by default", async () => {
    render(<SettingsSheet open={true} onOpenChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("ai-server-settings")).toBeInTheDocument();
    });
  });

  it("switches to AI Prompts section on click", async () => {
    render(<SettingsSheet open={true} onOpenChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("settings-nav-ai-prompts")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("settings-nav-ai-prompts"));

    await waitFor(() => {
      expect(screen.getByTestId("ai-template-settings")).toBeInTheDocument();
    });
  });

  it("switches to Appearance section on click", async () => {
    render(<SettingsSheet open={true} onOpenChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("settings-nav-appearance")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("settings-nav-appearance"));

    await waitFor(() => {
      expect(screen.getByTestId("appearance-settings")).toBeInTheDocument();
    });
  });

  it("respects initialSection prop", async () => {
    render(<SettingsSheet open={true} onOpenChange={() => {}} initialSection="appearance" />);

    await waitFor(() => {
      expect(screen.getByTestId("appearance-settings")).toBeInTheDocument();
    });
  });
});

describe("SettingsButton", () => {
  it("renders as a standalone button", () => {
    render(<SettingsButton />);
    expect(screen.getByTestId("button-settings")).toBeInTheDocument();
  });

  it("has correct accessibility label", () => {
    render(<SettingsButton />);
    expect(screen.getByLabelText("Open settings")).toBeInTheDocument();
  });
});

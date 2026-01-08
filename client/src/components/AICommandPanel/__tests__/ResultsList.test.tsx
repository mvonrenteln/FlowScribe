import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResultsList } from "../ResultsList";

describe("ResultsList", () => {
  it("calls onActivate when an item is clicked", async () => {
    const user = userEvent.setup();
    const handleActivate = vi.fn();
    const items = [{ id: "1", label: "First" }];

    render(
      <ResultsList
        items={items}
        getKey={(item) => item.id}
        getItemTitle={(item) => item.label}
        onActivate={handleActivate}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    await user.click(screen.getByText("First"));

    expect(handleActivate).toHaveBeenCalledWith(items[0]);
  });

  it("handles Enter/Space key activation", () => {
    const handleActivate = vi.fn();
    const items = [{ id: "1", label: "First" }];

    render(
      <ResultsList
        items={items}
        getKey={(item) => item.id}
        onActivate={handleActivate}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    const item = screen.getByText("First").closest("[role='button']");
    if (!item) throw new Error("Item wrapper not found");

    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.keyDown(item, { key: " " });

    expect(handleActivate).toHaveBeenCalledTimes(2);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RewrittenParagraph } from "@/components/rewrite/RewrittenParagraph";

describe("RewrittenParagraph", () => {
  it("keeps edited text scrollable when content exceeds the visible textarea height", async () => {
    const user = userEvent.setup();

    render(<RewrittenParagraph text="Initial paragraph" onTextChange={vi.fn()} />);

    await user.dblClick(screen.getByRole("button"));

    const textarea = screen.getByRole("textbox");
    expect(textarea.className).toContain("overflow-y-auto");
    expect(textarea.className).not.toContain("overflow-hidden");
  });
});

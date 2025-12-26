import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RevisionDialog } from "@/components/RevisionDialog";

describe("RevisionDialog", () => {
  it("validates the revision name before saving", async () => {
    const onCreateRevision = vi.fn().mockReturnValue("rev-1");
    const user = userEvent.setup();

    render(
      <RevisionDialog
        open
        onOpenChange={vi.fn()}
        onCreateRevision={onCreateRevision}
        canCreateRevision={true}
        activeSessionName="Transcript A"
        activeSessionKind="current"
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save revision" });

    await user.click(saveButton);
    expect(onCreateRevision).not.toHaveBeenCalled();
    expect(screen.getByText("Please provide a revision name.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Revision name"));
    await user.type(screen.getByLabelText("Revision name"), "  First pass  ");
    await user.click(saveButton);
    expect(onCreateRevision).toHaveBeenCalledWith("First pass");
  });

  it("disables saving when revisions cannot be created", () => {
    render(
      <RevisionDialog
        open
        onOpenChange={vi.fn()}
        onCreateRevision={vi.fn()}
        canCreateRevision={false}
        activeSessionName="Transcript A"
        activeSessionKind="revision"
      />,
    );

    expect(screen.getByRole("button", { name: "Save revision" })).toBeDisabled();
  });
});

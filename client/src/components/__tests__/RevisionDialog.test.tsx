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
        existingRevisionNames={[]}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save Revision" });

    await user.click(saveButton);
    expect(onCreateRevision).not.toHaveBeenCalled();
    expect(screen.getByText("Please provide a revision name.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Revision name"));
    await user.type(screen.getByLabelText("Revision name"), "  First pass  ");
    await user.click(saveButton);
    expect(onCreateRevision).toHaveBeenCalledWith("First pass", false);
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
        existingRevisionNames={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Save Revision" })).toBeDisabled();
  });

  it("prompts for overwrite when name exists", async () => {
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
        existingRevisionNames={["Existing Revision"]}
      />,
    );

    const input = screen.getByLabelText("Revision name");
    await user.type(input, "Existing Revision");
    await user.click(screen.getByRole("button", { name: "Save Revision" }));

    expect(onCreateRevision).not.toHaveBeenCalled();
    expect(screen.getByText("Overwrite existing revision?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overwrite" }));
    expect(onCreateRevision).toHaveBeenCalledWith("Existing Revision", true);
  });
});

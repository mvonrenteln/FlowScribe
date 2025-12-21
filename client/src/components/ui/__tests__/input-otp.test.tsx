import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OTPInputContext } from "input-otp";
import { InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

describe("InputOTPSeparator", () => {
  it("is focusable and provides the required ARIA value", () => {
    render(<InputOTPSeparator />);

    const separator = screen.getByRole("separator");

    expect(separator).toHaveAttribute("tabindex", "0");
    expect(separator).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders slots inside a group with OTP context", () => {
    render(
      <OTPInputContext.Provider
        value={{
          slots: [
            {
              char: "7",
              hasFakeCaret: false,
              isActive: true,
              placeholderChar: null,
            },
          ],
          isFocused: true,
          isHovering: false,
        }}
      >
        <InputOTPGroup data-testid="otp-group">
          <InputOTPSlot index={0} />
        </InputOTPGroup>
      </OTPInputContext.Provider>,
    );

    expect(screen.getByTestId("otp-group")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});

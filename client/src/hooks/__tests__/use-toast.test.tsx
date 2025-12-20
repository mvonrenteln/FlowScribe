import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast, useToast } from "@/hooks/use-toast";

describe("useToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to toast updates and clears after dismissal", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Hallo" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.title).toBe("Hallo");

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.toasts[0]?.open).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);
  });
});

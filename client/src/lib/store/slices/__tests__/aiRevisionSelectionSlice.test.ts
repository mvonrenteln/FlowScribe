import { create } from "zustand";
import { act } from "@testing-library/react";
import { createAiRevisionSelectionSlice } from "../aiRevisionSelectionSlice";

const STORAGE_KEY = "ai-revision-selection";

describe("aiRevisionSelectionSlice persistence", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("loads initial selection from localStorage", () => {
    const data = { providerId: "prov-1", model: "m-1" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const useTestStore = create((set) => ({ ...(createAiRevisionSelectionSlice as any)(set) }));
    const state = useTestStore.getState();

    expect(state.aiRevisionLastSelection).toEqual(data);
  });

  it("writes selection to localStorage when set", () => {
    const useTestStore = create((set) => ({ ...(createAiRevisionSelectionSlice as any)(set) }));
    const state = useTestStore.getState();

    act(() => {
      state.setAiRevisionLastSelection({ providerId: "prov-2", model: "m-2" });
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ providerId: "prov-2", model: "m-2" });
    expect(useTestStore.getState().aiRevisionLastSelection).toEqual({ providerId: "prov-2", model: "m-2" });
  });

  it("removes localStorage key when cleared", () => {
    const useTestStore = create((set) => ({ ...(createAiRevisionSelectionSlice as any)(set) }));
    const state = useTestStore.getState();

    act(() => {
      state.setAiRevisionLastSelection({ providerId: "prov-3", model: "m-3" });
    });

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    act(() => {
      state.setAiRevisionLastSelection(undefined);
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(useTestStore.getState().aiRevisionLastSelection).toBeUndefined();
  });
});

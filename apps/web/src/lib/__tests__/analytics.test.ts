// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { track, identify, trackOnce } from "../analytics";

type TestWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  posthog?: { capture: (...a: unknown[]) => void; identify: (...a: unknown[]) => void };
};

function w(): TestWindow {
  return window as unknown as TestWindow;
}

beforeEach(() => {
  window.localStorage.clear();
  w().gtag = vi.fn();
  w().posthog = { capture: vi.fn(), identify: vi.fn() };
});

describe("analytics fan-out", () => {
  it("track() forwards the event to both GA4 and PostHog", () => {
    track("test_event", { a: 1 });
    expect(w().gtag).toHaveBeenCalledWith("event", "test_event", { a: 1 });
    expect(w().posthog!.capture).toHaveBeenCalledWith("test_event", { a: 1 });
  });

  it("identify() sets the user id on both sinks", () => {
    identify("user-123", { plan: "free" });
    expect(w().gtag).toHaveBeenCalledWith("set", { user_id: "user-123" });
    expect(w().posthog!.identify).toHaveBeenCalledWith("user-123", { plan: "free" });
  });

  it("identify() ignores an empty id", () => {
    identify("");
    expect(w().posthog!.identify).not.toHaveBeenCalled();
  });

  it("trackOnce() fires at most once per key", () => {
    expect(trackOnce("k1", "evt_once")).toBe(true);
    expect(trackOnce("k1", "evt_once")).toBe(false);
    expect(w().posthog!.capture).toHaveBeenCalledTimes(1);
  });

  it("never throws when no analytics sinks are present", () => {
    delete w().gtag;
    delete w().posthog;
    expect(() => track("noop", { x: true })).not.toThrow();
    expect(() => identify("x")).not.toThrow();
    expect(() => trackOnce("k2", "noop")).not.toThrow();
  });
});

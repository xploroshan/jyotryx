// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { track, identify, trackOnce } from "../analytics";

type TestWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  posthog?: { capture: (...a: unknown[]) => void; identify: (...a: unknown[]) => void };
  __phq?: [string, ...unknown[]][];
};

function w(): TestWindow {
  return window as unknown as TestWindow;
}

beforeEach(() => {
  window.localStorage.clear();
  w().gtag = vi.fn();
  w().posthog = { capture: vi.fn(), identify: vi.fn() };
  delete w().dataLayer;
  delete w().__phq;
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

describe("pre-load queueing (SDKs are lazyOnload — events must not be dropped)", () => {
  beforeEach(() => {
    delete w().gtag;
    delete w().posthog;
  });

  it("track() before gtag.js loads queues an Arguments entry in dataLayer", () => {
    track("early_event", { a: 1 });
    const dl = w().dataLayer!;
    expect(dl).toHaveLength(1);
    // gtag.js only drains Arguments objects — a plain array would be ignored.
    expect(Array.isArray(dl[0])).toBe(false);
    expect(Array.from(dl[0] as ArrayLike<unknown>)).toEqual(["event", "early_event", { a: 1 }]);
  });

  it("track() before PostHog loads buffers in __phq for the init script to drain", () => {
    track("early_event", { a: 1 });
    track("second", undefined);
    expect(w().__phq).toEqual([
      ["capture", "early_event", { a: 1 }],
      ["capture", "second", undefined],
    ]);
  });

  it("identify() before load queues on both sides", () => {
    identify("user-9", { plan: "pro" });
    expect(Array.from(w().dataLayer![0] as ArrayLike<unknown>)).toEqual([
      "set",
      { user_id: "user-9" },
    ]);
    expect(w().__phq).toEqual([["identify", "user-9", { plan: "pro" }]]);
  });

  it("queues are NOT touched once the real sinks exist", () => {
    w().gtag = vi.fn();
    w().posthog = { capture: vi.fn(), identify: vi.fn() };
    track("late_event");
    expect(w().dataLayer).toBeUndefined();
    expect(w().__phq).toBeUndefined();
  });
});

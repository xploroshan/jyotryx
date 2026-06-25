// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: trackMock }));

import { ShareButton } from "../ShareButton";

const props = {
  url: "/horoscope/aries",
  text: "Aries horoscope",
  trigger: "horoscope",
  shareLabel: "Share",
  copyLabel: "Copy link",
  copiedLabel: "Copied!",
};

beforeEach(() => {
  trackMock.mockClear();
  // Reset the share capability between tests so order doesn't leak.
  delete (navigator as unknown as { share?: unknown }).share;
});

describe("ShareButton", () => {
  it("copies the absolute link and tracks share_clicked(copy)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ShareButton {...props} />);
    fireEvent.click(screen.getByText("Copy link"));

    expect(await screen.findByText("Copied!")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/horoscope/aries`);
    expect(trackMock).toHaveBeenCalledWith("share_clicked", { trigger: "horoscope", method: "copy" });
  });

  it("uses the native share sheet when available and tracks share_clicked(native)", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });

    render(<ShareButton {...props} />);
    fireEvent.click(screen.getByText("Share"));

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(trackMock).toHaveBeenCalledWith("share_clicked", { trigger: "horoscope", method: "native" });
  });
});

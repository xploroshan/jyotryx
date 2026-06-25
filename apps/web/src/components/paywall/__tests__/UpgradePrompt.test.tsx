// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

const { push, trackMock } = vi.hoisted(() => ({ push: vi.fn(), trackMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/analytics", () => ({ track: trackMock }));

import { UpgradePrompt } from "../UpgradePrompt";

const baseProps = {
  trigger: "chat_credits",
  title: "Go unlimited",
  message: "You're out of credits.",
  primaryCta: "Subscribe",
  onClose: vi.fn(),
};

beforeEach(() => {
  push.mockClear();
  trackMock.mockClear();
});

describe("UpgradePrompt", () => {
  it("renders nothing while closed and fires no analytics", () => {
    render(<UpgradePrompt open={false} {...baseProps} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("fires paywall_view when opened", () => {
    render(<UpgradePrompt open {...baseProps} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith("paywall_view", { trigger: "chat_credits" });
  });

  it("primary CTA tracks the click and routes to pricing", () => {
    render(<UpgradePrompt open {...baseProps} />);
    fireEvent.click(screen.getByText("Subscribe"));
    expect(trackMock).toHaveBeenCalledWith("paywall_click", { trigger: "chat_credits", cta: "primary" });
    expect(push).toHaveBeenCalledWith("/pricing");
  });

  it("dismissing tracks paywall_dismiss and calls onClose", () => {
    const onClose = vi.fn();
    render(<UpgradePrompt open {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(trackMock).toHaveBeenCalledWith("paywall_dismiss", { trigger: "chat_credits" });
    expect(onClose).toHaveBeenCalled();
  });
});

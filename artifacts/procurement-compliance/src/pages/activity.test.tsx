import { render, screen } from "@testing-library/react";
import type { Activity as ActivityItem } from "@workspace/api-client-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import Activity from "./activity";

const decisionReference = "11111111-1111-4111-8111-111111111111";

const activities: ActivityItem[] = [
  {
    id: "decision-1",
    actor: "SYSTEM",
    action: "mengevaluasi kepatuhan",
    target: "Paket #41",
    timestamp: "2026-09-20T12:00:00.000Z",
    tone: "positive",
    decisionReference,
    packageId: 41,
  },
  {
    id: "activity-1",
    actor: "Tim Reviu",
    action: "memperbarui paket",
    target: "PKG-042",
    timestamp: "2026-09-20T11:00:00.000Z",
    tone: "info",
  },
];

vi.mock("wouter", () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@workspace/api-client-react", () => ({
  useListActivity: () => ({
    data: activities,
    isLoading: false,
    isError: false,
  }),
}));

describe("Activity", () => {
  it("menautkan hanya aktivitas evaluasi yang memiliki decision reference", () => {
    render(<Activity />);

    expect(screen.getByText(decisionReference)).toBeVisible();
    expect(screen.getByRole("link", { name: /buka keputusan/i })).toHaveAttribute(
      "href",
      `/packages/41?decisionReference=${decisionReference}`,
    );
    expect(screen.getAllByRole("link", { name: /buka keputusan/i })).toHaveLength(1);
  });
});
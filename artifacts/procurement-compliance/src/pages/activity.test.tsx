import { render, screen } from "@testing-library/react";
import type { Activity as ActivityItem } from "@workspace/api-client-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import Activity from "./activity";

const decisionReference = "11111111-1111-4111-8111-111111111111";

const activities: ActivityItem[] = [
  {
    id: "decision-1",
    actor: "Sari Wijaya",
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
  useListActivity: ({ page }: { page: number }) => ({
    data: {
      items: page === 1 ? [activities[1]] : [activities[0]],
      page,
      hasMore: page === 1,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
  }),
}));

describe("Activity", () => {
  it("membuka keputusan yang muncul di halaman riwayat berikutnya", async () => {
    const user = userEvent.setup();
    render(<Activity />);

    expect(screen.queryByRole("link", { name: /buka keputusan/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lebih lama" }));
    expect(screen.getByText("Halaman 2")).toBeVisible();
    expect(screen.getByText(decisionReference)).toBeVisible();
    expect(screen.getByText("Sari Wijaya")).toBeVisible();
    expect(screen.getByRole("link", { name: /buka keputusan/i })).toHaveAttribute(
      "href",
      `/packages/41?decisionReference=${decisionReference}`,
    );
    expect(screen.getAllByRole("link", { name: /buka keputusan/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Lebih lama" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Lebih baru" }));
    expect(screen.queryByRole("link", { name: /buka keputusan/i })).not.toBeInTheDocument();
  });
});
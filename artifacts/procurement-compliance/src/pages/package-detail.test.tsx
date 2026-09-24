import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  ProcurementPackageDetail,
  PublishedPolicyPack,
  RuleEvaluationResult,
  StoredDecision,
} from "@workspace/api-client-react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PackageDetail from "./package-detail";

const state = vi.hoisted(() => ({
  publishedPacks: [] as PublishedPolicyPack[],
  publishedPacksLoading: false,
  publishedPacksError: false,
  evaluationResult: null as RuleEvaluationResult | null,
  evaluationError: null as (Error & { data?: { error?: string } }) | null,
  evaluationMutate: vi.fn(),
  decisions: [] as StoredDecision[],
  storedDecision: null as StoredDecision | null,
  storedDecisionError: null as (Error & { status?: number; data?: { error?: string } }) | null,
}));

vi.mock("wouter", () => ({
  useParams: () => ({ id: "41" }),
  Link: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@workspace/api-client-react", async () => {
  const React = await import("react");
  return {
    getGetPackageQueryKey: (id: number) => ["packages", id],
    useGetPackage: () => ({ data: packageFixture, isLoading: false, isError: false }),
    useUpdatePackage: () => ({ mutate: vi.fn(), isPending: false }),
    useListPublishedPolicyPacks: () => ({
      data: state.publishedPacks,
      isLoading: state.publishedPacksLoading,
      isError: state.publishedPacksError,
    }),
    getGetDecisionQueryKey: (reference: string) => ["decisions", reference],
    useListDecisions: () => ({
      data: state.decisions,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useGetDecision: () => ({
      data: state.storedDecision ?? undefined,
      error: state.storedDecisionError,
      isLoading: false,
      isError: Boolean(state.storedDecisionError),
    }),
    useEvaluateRules: () => {
      const [data, setData] = React.useState<RuleEvaluationResult | undefined>();
      const [error, setError] = React.useState<typeof state.evaluationError>(null);
      return {
        data,
        error,
        isPending: false,
        isError: Boolean(error),
        reset: () => {
          setData(undefined);
          setError(null);
        },
        mutate: (request: unknown) => {
          state.evaluationMutate(request);
          if (state.evaluationError) setError(state.evaluationError);
          else if (state.evaluationResult) setData(state.evaluationResult);
        },
      };
    },
  };
});

const packageFixture: ProcurementPackageDetail = {
  id: 41,
  code: "PKG-041",
  title: "Pengadaan perangkat layanan publik",
  agency: "Dinas Pelayanan",
  method: "tender",
  status: "review",
  budget: 250_000_000,
  pdnTarget: 40,
  compliance: 92,
  dueDate: "2026-10-01T00:00:00.000Z",
  owner: "PPK Uji",
  updatedAt: "2026-09-20T00:00:00.000Z",
  description: "Paket untuk pengujian alasan kepatuhan.",
  steps: [],
  documents: [],
};

const publishedPack: PublishedPolicyPack = {
  id: "pack-published-1",
  packName: "Pack Kepatuhan Nasional",
  regimeType: "NATIONAL",
  version: "1.0.0",
  status: "PUBLISHED",
  publishedAt: "2026-09-19T00:00:00.000Z",
  publishedBy: "publisher-1",
  ruleCount: 1,
};

const evaluationFixture: RuleEvaluationResult = {
  decisionReference: "11111111-1111-4111-8111-111111111111",
  policyPack: {
    id: publishedPack.id,
    name: publishedPack.packName,
    version: publishedPack.version,
    status: "PUBLISHED",
  },
  input: {
    entityType: "PROCUREMENT_PACKAGE",
    entityId: String(packageFixture.id),
    policyPackId: publishedPack.id,
    context: { packageValue: packageFixture.budget, procurementMethod: packageFixture.method },
  },
  output: {
    status: "COMPLIANT",
    passed: 1,
    failed: 0,
    mandatoryFailed: 0,
    notApplicable: 0,
  },
  rules: [
    {
      rule: {
        id: "rule-snapshot-1",
        key: "minimum_package_value",
        category: "COMPLIANCE",
        description: "Nilai paket memenuhi ambang aturan",
        valueType: "BOOLEAN",
        mandatory: true,
      },
      provision: {
        id: "provision-1",
        articleNumber: "12 ayat (3)",
        provisionType: "COMPLIANCE",
        rawText: "Nilai paket wajib memenuhi ambang yang ditetapkan.",
      },
      source: {
        id: "source-1",
        regulationCode: "PERPRES-TEST-2026",
        title: "Peraturan Pengadaan Uji",
        issuingAuthority: "Pemerintah Republik Indonesia",
        authorityLevel: 1,
        isBinding: true,
      },
      verificationStatus: "VERIFIED",
      input: {
        packageValue: packageFixture.budget,
        procurementMethod: packageFixture.method,
      },
      output: {
        status: "PASS",
        value: true,
        referencedPaths: ["packageValue"],
      },
    },
  ],
};

const storedDecisionFixture: StoredDecision = {
  ...evaluationFixture,
  evaluatedAt: "2026-09-20T08:30:00.000Z",
  evaluatorVersion: "dre-ast-v1",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PackageDetail />
    </QueryClientProvider>,
  );
}

describe("detail paket: evaluasi kepatuhan", () => {
  beforeEach(() => {
    state.publishedPacks = [];
    state.publishedPacksLoading = false;
    state.publishedPacksError = false;
    state.evaluationResult = null;
    state.evaluationError = null;
    state.evaluationMutate.mockReset();
    state.decisions = [];
    state.storedDecision = null;
    state.storedDecisionError = null;
    window.history.replaceState(null, "", "/packages/41");
  });

  it("menjalankan pack PUBLISHED dan menampilkan alasan keputusan lengkap dari snapshot rule", async () => {
    state.publishedPacks = [publishedPack];
    state.evaluationResult = evaluationFixture;
    const user = userEvent.setup();

    renderPage();
    expect(screen.getByRole("heading", { name: packageFixture.title })).toBeVisible();
    expect(screen.getByRole("option", { name: /Pack Kepatuhan Nasional/ })).toBeVisible();

    await user.click(screen.getByTestId("button-evaluate-compliance"));

    expect(state.evaluationMutate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "PROCUREMENT_PACKAGE",
        entityId: String(packageFixture.id),
        policyPackId: publishedPack.id,
        context: expect.objectContaining({
          packageValue: packageFixture.budget,
          procurementMethod: packageFixture.method,
        }),
      }),
    });
    expect(screen.getByTestId("status-evaluation-summary")).toHaveTextContent("Patuh");
    expect(screen.getByTestId("text-decision-reference")).toHaveTextContent(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("PERPRES-TEST-2026 · Pasal 12 ayat (3)")).toBeVisible();
    expect(screen.getByText("Peraturan Pengadaan Uji")).toBeVisible();
    expect(screen.getByText("Pemerintah Republik Indonesia")).toBeVisible();
    expect(screen.getByText("VERIFIED")).toBeVisible();
    expect(screen.getAllByText(/\"packageValue\": 250000000/)).toHaveLength(2);
    expect(screen.getByText("Referensi: packageValue")).toBeVisible();
    expect(screen.getByText("Nilai:", { exact: false }).parentElement).toHaveTextContent("true");
  });

  it("menampilkan kegagalan evaluasi", async () => {
    state.publishedPacks = [publishedPack];
    state.evaluationError = Object.assign(new Error("Request failed"), {
      data: { error: "Snapshot aturan tidak tersedia" },
    });

    renderPage();
    await userEvent.click(screen.getByTestId("button-evaluate-compliance"));

    expect(screen.getByTestId("status-evaluation-error")).toHaveTextContent(
      "Snapshot aturan tidak tersedia",
    );
  });

  it("menampilkan state kosong saat belum ada policy pack terpublikasi", () => {
    renderPage();

    expect(screen.getByTestId("status-no-published-policy-pack")).toHaveTextContent(
      "Policy pack terpublikasi belum tersedia",
    );
    expect(screen.queryByTestId("button-evaluate-compliance")).not.toBeInTheDocument();
  });

  it("menahan pilihan dan evaluasi saat daftar policy pack masih dimuat", () => {
    state.publishedPacksLoading = true;

    renderPage();

    expect(screen.getByTestId("status-policy-packs-loading")).toHaveTextContent(
      "Memuat policy pack terpublikasi...",
    );
    expect(screen.queryByTestId("select-policy-pack")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-evaluate-compliance")).not.toBeInTheDocument();
  });

  it("menampilkan arahan memuat ulang saat daftar policy pack gagal dimuat", () => {
    state.publishedPacksError = true;

    renderPage();

    expect(screen.getByTestId("status-policy-packs-error")).toHaveTextContent(
      "Policy pack gagal dimuat",
    );
    expect(screen.getByTestId("status-policy-packs-error")).toHaveTextContent(
      "Muat ulang halaman untuk mencoba kembali.",
    );
    expect(screen.queryByTestId("button-evaluate-compliance")).not.toBeInTheDocument();
  });

  it("membuka snapshot keputusan lama dari riwayat tanpa menjalankan evaluasi ulang", async () => {
    state.decisions = [storedDecisionFixture];
    state.storedDecision = storedDecisionFixture;

    renderPage();
    await userEvent.click(
      screen.getByTestId(`button-open-decision-${storedDecisionFixture.decisionReference}`),
    );

    expect(state.evaluationMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("text-decision-reference")).toHaveTextContent(
      storedDecisionFixture.decisionReference,
    );
    expect(screen.getByText("dre-ast-v1")).toBeVisible();
    expect(screen.getByText("Snapshot input")).toBeVisible();
    expect(window.location.search).toContain(
      `decisionReference=${storedDecisionFixture.decisionReference}`,
    );
  });

  it("menampilkan pesan yang jelas saat decision reference tidak ditemukan", () => {
    state.storedDecisionError = Object.assign(new Error("Not found"), {
      status: 404,
      data: { error: "Decision reference tidak ditemukan" },
    });
    window.history.replaceState(
      null,
      "",
      "/packages/41?decisionReference=22222222-2222-4222-8222-222222222222",
    );

    renderPage();

    expect(screen.getByTestId("status-decision-not-found")).toHaveTextContent(
      "Decision reference tidak ditemukan",
    );
    expect(state.evaluationMutate).not.toHaveBeenCalled();
  });
});
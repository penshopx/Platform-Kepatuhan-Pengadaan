import { useEffect, useState } from "react";
import {
  type PublishedPolicyPack,
  type ProcurementPackageDetail,
  type RuleEvaluationResult,
  useEvaluateRules,
  useListPublishedPolicyPacks,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clipboard,
  FileSearch,
  Loader2,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ApiFailure = Error & {
  data?: { error?: string } | null;
};

const summaryStyles: Record<string, string> = {
  COMPLIANT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  NON_COMPLIANT: "border-destructive/30 bg-destructive/10 text-destructive",
  NOT_APPLICABLE: "border-border bg-secondary/50 text-muted-foreground",
};

const ruleStyles: Record<string, string> = {
  PASS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  FAIL: "border-destructive/30 bg-destructive/10 text-destructive",
  NOT_APPLICABLE: "border-border bg-secondary/50 text-muted-foreground",
};

function formatValue(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function EvaluationResults({ result }: { result: RuleEvaluationResult }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(result.decisionReference);
      setCopied(true);
      toast({ title: "Decision reference disalin" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Gagal menyalin",
        description: "Salin decision reference secara manual.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-5 ${summaryStyles[result.output.status]}`}
        data-testid="status-evaluation-summary"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider">Keputusan</p>
            <p className="mt-1 text-2xl font-bold">
              {result.output.status === "COMPLIANT"
                ? "Patuh"
                : result.output.status === "NON_COMPLIANT"
                  ? "Tidak Patuh"
                  : "Tidak Berlaku"}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {result.policyPack.name} · versi {result.policyPack.version}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-bold">{result.output.passed}</div>
              <div className="text-xs opacity-75">Lulus</div>
            </div>
            <div>
              <div className="text-xl font-bold">{result.output.failed}</div>
              <div className="text-xs opacity-75">Gagal</div>
            </div>
            <div>
              <div className="text-xl font-bold">{result.output.notApplicable}</div>
              <div className="text-xs opacity-75">N/A</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-secondary/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Decision reference
            </p>
            <code
              className="mt-1 block break-all text-sm font-semibold text-foreground"
              data-testid="text-decision-reference"
            >
              {result.decisionReference}
            </code>
          </div>
          <button
            type="button"
            onClick={copyReference}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
            data-testid="button-copy-decision-reference"
          >
            {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            {copied ? "Tersalin" : "Salin"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Penjelasan rule ({result.rules.length})</h3>
        {result.rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Policy pack ini tidak memiliki rule untuk dievaluasi.
          </p>
        ) : (
          result.rules.map((explanation, index) => (
            <article
              key={`${explanation.rule.id}-${index}`}
              className="overflow-hidden rounded-xl border border-border bg-card"
              data-testid={`card-rule-explanation-${explanation.rule.id}`}
            >
              <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{explanation.rule.key}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold uppercase">
                      {explanation.rule.category}
                    </span>
                    {explanation.rule.mandatory && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        Wajib
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 font-semibold">
                    {explanation.rule.description || "Rule kepatuhan"}
                  </h4>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${ruleStyles[explanation.output.status]}`}
                  data-testid={`status-rule-${explanation.rule.id}`}
                >
                  {explanation.output.status === "PASS" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  {explanation.output.status.replace("_", " ")}
                </span>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-2">
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dasar hukum
                    </p>
                    <p className="mt-1 font-medium">
                      {explanation.source.regulationCode} · Pasal {explanation.provision.articleNumber}
                    </p>
                    <p className="mt-1 text-muted-foreground">{explanation.source.title}</p>
                    <p className="mt-2 rounded-md bg-secondary/50 p-3 text-sm leading-relaxed">
                      {explanation.provision.rawText}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Sumber dan verifikasi
                    </p>
                    <p className="mt-1">{explanation.source.issuingAuthority}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                        Otoritas level {explanation.source.authorityLevel}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                        {explanation.source.isBinding ? "Mengikat" : "Tidak mengikat"}
                      </span>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                        {explanation.verificationStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Input rule
                    </p>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-secondary/50 p-3 text-xs leading-relaxed">
                      {formatValue(explanation.input)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Output rule
                    </p>
                    <div className="mt-2 rounded-md bg-secondary/50 p-3 text-xs">
                      <p>
                        <span className="text-muted-foreground">Nilai:</span>{" "}
                        <strong>{formatValue(explanation.output.value)}</strong>
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        Referensi: {explanation.output.referencedPaths.join(", ") || "Tidak ada"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function PackageComplianceEvaluation({ pkg }: { pkg: ProcurementPackageDetail }) {
  const { data: publishedPacks, isLoading, isError } = useListPublishedPolicyPacks();
  const [selectedPackId, setSelectedPackId] = useState("");
  const evaluation = useEvaluateRules();

  useEffect(() => {
    if (!selectedPackId && publishedPacks && publishedPacks.length > 0) {
      setSelectedPackId(publishedPacks[0].id);
    }
  }, [publishedPacks, selectedPackId]);

  const evaluate = () => {
    if (!selectedPackId) return;
    evaluation.mutate({
      data: {
        entityType: "PROCUREMENT_PACKAGE",
        entityId: String(pkg.id),
        policyPackId: selectedPackId,
        context: {
          packageValue: pkg.budget,
          procurementMethod: pkg.method,
          agency: pkg.agency,
          pdnTarget: pkg.pdnTarget,
          evaluationDate: new Date().toISOString().slice(0, 10),
        },
      },
    });
  };

  const error = evaluation.error as ApiFailure | null;

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm" data-testid="section-compliance-evaluation">
      <div className="border-b border-border bg-secondary/20 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Evaluasi Kepatuhan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Evaluasi paket terhadap snapshot rule dari policy pack terpublikasi.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {isLoading ? (
          <div className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm text-muted-foreground" data-testid="status-policy-packs-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat policy pack terpublikasi...
          </div>
        ) : isError ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive" data-testid="status-policy-packs-error">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Policy pack gagal dimuat</p>
              <p className="mt-1 text-sm opacity-80">Muat ulang halaman untuk mencoba kembali.</p>
            </div>
          </div>
        ) : !publishedPacks || publishedPacks.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200" data-testid="status-no-published-policy-pack">
            <FileSearch className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Policy pack terpublikasi belum tersedia</p>
              <p className="mt-1 text-sm opacity-80">
                Minta administrator legal meninjau dan memublikasikan policy pack sebelum evaluasi.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium">
              Policy pack
              <select
                value={selectedPackId}
                onChange={(event) => {
                  setSelectedPackId(event.target.value);
                  evaluation.reset();
                }}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-policy-pack"
              >
                {publishedPacks.map((pack: PublishedPolicyPack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.packName} · v{pack.version} ({pack.ruleCount} rule)
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={evaluate}
              disabled={!selectedPackId || evaluation.isPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="button-evaluate-compliance"
            >
              {evaluation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scale className="h-4 w-4" />
              )}
              {evaluation.isPending ? "Mengevaluasi..." : "Jalankan Evaluasi"}
            </button>
          </div>
        )}

        {evaluation.isError && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive" data-testid="status-evaluation-error">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Evaluasi gagal dijalankan</p>
              <p className="mt-1 text-sm opacity-80">
                {error?.data?.error || error?.message || "Terjadi kesalahan saat mengevaluasi paket."}
              </p>
            </div>
          </div>
        )}

        {evaluation.data && <EvaluationResults result={evaluation.data} />}
      </div>
    </section>
  );
}
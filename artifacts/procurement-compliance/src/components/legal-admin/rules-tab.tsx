import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBusinessRules,
  useCreateBusinessRule,
  useListLegalSources,
  getListBusinessRulesQueryKey,
  type BusinessRuleInput,
  BusinessRuleInputValueType,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Layers, Scale, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function RulesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useListBusinessRules();
  const { data: sources = [] } = useListLegalSources();
  
  const createRule = useCreateBusinessRule();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredRules = rules.filter((rule) =>
    `${rule.ruleKey} ${rule.description ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  // Flatten provisions for select
  const allProvisions = sources.flatMap(s => 
    (s.provisions || []).map(p => ({
      ...p,
      sourceTitle: s.title,
      regulationCode: s.regulationCode
    }))
  );

  const [newRule, setNewRule] = useState<Partial<BusinessRuleInput>>({
    provisionId: "",
    ruleKey: "",
    ruleCategory: "ELIGIBILITY",
    valueType: "BOOLEAN",
    defaultValue: true,
    version: 1,
    effectiveDate: new Date().toISOString().split('T')[0],
  });

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate(
      { data: newRule as BusinessRuleInput },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBusinessRulesQueryKey() });
          setIsCreateOpen(false);
          toast({ title: "Berhasil", description: "Aturan bisnis baru telah ditambahkan." });
          setNewRule({
            provisionId: "",
            ruleKey: "",
            ruleCategory: "ELIGIBILITY",
            valueType: "BOOLEAN",
            defaultValue: true,
            version: 1,
            effectiveDate: new Date().toISOString().split('T')[0],
          });
        },
        onError: (err: any) => {
          toast({
            title: "Gagal",
            description: err?.data?.error || "Gagal menambahkan aturan bisnis.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari rule key atau deskripsi..."
            className="pl-9 bg-card border-border/50"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Buat Aturan Bisnis</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Buat Aturan Bisnis</DialogTitle>
              <DialogDescription>
                Aturan bisnis mengubah teks pasal menjadi logika yang dapat dieksekusi mesin.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRule} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Dasar Hukum (Pasal)</Label>
                  <select 
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={newRule.provisionId}
                    onChange={e => setNewRule(s => ({ ...s, provisionId: e.target.value }))}
                  >
                    <option value="" disabled>Pilih Pasal...</option>
                    {allProvisions.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.regulationCode} - {p.articleNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Rule Key (Kunci Mesin)</Label>
                  <Input 
                    required 
                    placeholder="Contoh: pdn_minimum_requirement" 
                    className="font-mono text-primary"
                    value={newRule.ruleKey} 
                    onChange={e => setNewRule(s => ({ ...s, ruleKey: e.target.value }))} 
                  />
                  <p className="text-xs text-muted-foreground">Harus unik dan menggunakan format snake_case.</p>
                </div>
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={newRule.ruleCategory}
                    onChange={e => setNewRule(s => ({ ...s, ruleCategory: e.target.value }))}
                  >
                    <option value="ELIGIBILITY">Eligibility (Kualifikasi)</option>
                    <option value="COMPLIANCE">Compliance (Kepatuhan)</option>
                    <option value="SCORING">Scoring (Penilaian)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tipe Nilai</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={newRule.valueType}
                    onChange={e => setNewRule(s => ({ ...s, valueType: e.target.value as BusinessRuleInputValueType }))}
                  >
                    <option value="BOOLEAN">Boolean (Ya/Tidak)</option>
                    <option value="NUMBER">Angka</option>
                    <option value="STRING">Teks</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Deskripsi</Label>
                  <Input 
                    placeholder="Penjelasan singkat aturan ini..." 
                    value={newRule.description || ""} 
                    onChange={e => setNewRule(s => ({ ...s, description: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Berlaku</Label>
                  <Input 
                    type="date"
                    required 
                    value={newRule.effectiveDate} 
                    onChange={e => setNewRule(s => ({ ...s, effectiveDate: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Berakhir</Label>
                  <Input
                    type="date"
                    value={newRule.expiryDate || ""}
                    onChange={e => setNewRule(s => ({ ...s, expiryDate: e.target.value || undefined }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jenis Entitas</Label>
                  <Input
                    placeholder="Contoh: PROCUREMENT_PACKAGE"
                    value={newRule.entityType || ""}
                    onChange={e => setNewRule(s => ({ ...s, entityType: e.target.value || undefined }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sumber Dana</Label>
                  <Input
                    placeholder="Contoh: APBN"
                    value={newRule.fundingSource || ""}
                    onChange={e => setNewRule(s => ({ ...s, fundingSource: e.target.value || undefined }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Metode Pengadaan</Label>
                  <Input
                    placeholder="Contoh: e-purchasing"
                    value={newRule.procurementMethod || ""}
                    onChange={e => setNewRule(s => ({ ...s, procurementMethod: e.target.value || undefined }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nilai Paket Minimum</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newRule.packageValueMin ?? ""}
                    onChange={e => setNewRule(s => ({ ...s, packageValueMin: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nilai Paket Maksimum</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newRule.packageValueMax ?? ""}
                    onChange={e => setNewRule(s => ({ ...s, packageValueMax: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipe Cakupan</Label>
                  <Input
                    placeholder="Contoh: ORGANIZATION"
                    value={newRule.scopeType || ""}
                    onChange={e => setNewRule(s => ({ ...s, scopeType: e.target.value || undefined }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID Cakupan</Label>
                  <Input
                    placeholder="ID unit/organisasi"
                    value={newRule.scopeId || ""}
                    onChange={e => setNewRule(s => ({ ...s, scopeId: e.target.value || undefined }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nilai Bawaan (Default)</Label>
                  {newRule.valueType === 'BOOLEAN' ? (
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onChange={e => setNewRule(s => ({ ...s, defaultValue: e.target.value === 'true' }))}
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : newRule.valueType === 'NUMBER' ? (
                    <Input 
                      type="number"
                      onChange={e => setNewRule(s => ({ ...s, defaultValue: e.target.value ? Number(e.target.value) : undefined }))}
                    />
                  ) : (
                    <Input 
                      onChange={e => setNewRule(s => ({ ...s, defaultValue: e.target.value }))} 
                    />
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button type="submit" disabled={createRule.isPending}>
                  {createRule.isPending ? "Menyimpan..." : "Simpan Aturan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">Memuat data...</div>
        ) : filteredRules.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg text-muted-foreground bg-secondary/10">
            <Layers className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p>Belum ada aturan bisnis.</p>
            <p className="text-xs mt-1">Buat aturan pertama untuk mulai membangun logika kepatuhan.</p>
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div key={rule.id} className="flex flex-col bg-card border border-border/50 rounded-lg p-5 shadow-sm hover:border-primary/30 transition-colors group">
              <div className="flex justify-between items-start mb-3">
                <Badge variant="secondary" className="font-mono text-xs bg-secondary/50">{rule.ruleCategory}</Badge>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full ${rule.isActive ? "bg-emerald-500" : "bg-muted-foreground"}`}></span>
                  v{rule.version}
                </div>
              </div>
              
              <h3 className="font-mono font-bold text-primary mb-1 break-all">{rule.ruleKey}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                {rule.description || "Tidak ada deskripsi"}
              </p>
              
              <div className="mt-auto space-y-2 pt-4 border-t border-border/30">
                <div className="flex items-center text-xs text-foreground/80">
                  <Scale className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  <span className="truncate">{rule.sourceTitle} - {rule.articleNumber}</span>
                </div>
                <div className="flex items-center text-xs text-foreground/80">
                  <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  {rule.conditions?.[0]?.effectiveDate ? format(new Date(rule.conditions[0].effectiveDate), 'dd MMM yyyy') : 'Tanpa tanggal'}
                </div>
                <div className="flex items-center text-xs text-foreground/80">
                  <Layers className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  Tipe: {rule.valueType} 
                  {rule.defaultValue !== undefined && <span className="ml-1 opacity-70">(Def: {String(rule.defaultValue)})</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

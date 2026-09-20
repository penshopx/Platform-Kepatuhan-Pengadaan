import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPolicyPacks,
  useCreatePolicyPack,
  useAddPolicyPackRule,
  useTransitionPolicyPack,
  useListBusinessRules,
  getListPolicyPacksQueryKey,
  type PolicyPack,
  type PolicyPackInput,
  type PolicyPackRuleInput,
  PolicyPackStatus,
  PolicyPackTransitionStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Archive, ChevronRight, Lock, Unlock, Zap, Ban, Layers } from "lucide-react";
import { format } from "date-fns";

export default function PacksTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: packs = [], isLoading: isLoadingPacks } = useListPolicyPacks();
  const { data: rules = [] } = useListBusinessRules();
  
  const createPack = useCreatePolicyPack();
  const addRule = useAddPolicyPackRule();
  const transitionPack = useTransitionPolicyPack();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<PolicyPack | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);

  const [newPack, setNewPack] = useState<Partial<PolicyPackInput>>({
    packName: "",
    regimeType: "UMUM",
    version: "1.0.0",
    description: "",
  });

  const [newRuleRef, setNewRuleRef] = useState<Partial<PolicyPackRuleInput>>({
    businessRuleId: "",
    ruleConditionId: "",
    isMandatory: true,
  });

  const handleCreatePack = (e: React.FormEvent) => {
    e.preventDefault();
    createPack.mutate(
      { data: newPack as PolicyPackInput },
      {
        onSuccess: (pack) => {
          queryClient.invalidateQueries({ queryKey: getListPolicyPacksQueryKey() });
          setSelectedPack(pack);
          setIsCreateOpen(false);
          toast({ title: "Berhasil", description: "Policy pack baru telah dibuat." });
          setNewPack({
            packName: "",
            regimeType: "UMUM",
            version: "1.0.0",
            description: "",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Gagal",
            description: err?.data?.error || "Gagal membuat policy pack.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPack) return;
    
    // Default condition ID if empty
    const ruleInput = { ...newRuleRef };
    if (!ruleInput.ruleConditionId) {
      const selectedRuleData = rules.find(r => r.id === ruleInput.businessRuleId);
      if (selectedRuleData && selectedRuleData.conditions.length > 0) {
        ruleInput.ruleConditionId = selectedRuleData.conditions[0].id;
      } else {
        toast({ title: "Gagal", description: "Aturan bisnis ini tidak memiliki kondisi aktif.", variant: "destructive" });
        return;
      }
    }

    addRule.mutate(
      { id: selectedPack.id, data: ruleInput as PolicyPackRuleInput },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPolicyPacksQueryKey() });
          setIsAddRuleOpen(false);
          toast({ title: "Berhasil", description: "Aturan ditambahkan ke dalam pack." });
          setNewRuleRef({ businessRuleId: "", ruleConditionId: "", isMandatory: true });
        },
        onError: (err: any) => {
          toast({
            title: "Gagal",
            description: err?.data?.error || "Gagal menambahkan aturan.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleTransition = (id: string, status: PolicyPackTransitionStatus) => {
    transitionPack.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPolicyPacksQueryKey() });
          toast({ title: "Berhasil", description: `Status policy pack diubah menjadi ${status}.` });
          setIsViewOpen(false); // Close view to let list refresh
        },
        onError: (err: any) => {
          toast({
            title: "Transisi Gagal",
            description: err?.data?.error || "Terjadi kesalahan saat memproses.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const getStatusBadge = (status: PolicyPackStatus) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30"><Zap className="w-3 h-3 mr-1" /> Published</Badge>;
      case "REVIEWED":
        return <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border-blue-500/30"><ChevronRight className="w-3 h-3 mr-1" /> Reviewed</Badge>;
      case "RETIRED":
        return <Badge className="bg-muted text-muted-foreground hover:bg-muted/80"><Archive className="w-3 h-3 mr-1" /> Retired</Badge>;
      case "DRAFT":
      default:
        return <Badge variant="outline" className="border-dashed"><Unlock className="w-3 h-3 mr-1" /> Draft</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">Kumpulan Kebijakan (Policy Packs)</h2>
          <p className="text-sm text-muted-foreground">Gabungkan aturan bisnis menjadi satu versi rilis yang siap dieksekusi.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Buat Pack Baru</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Policy Pack</DialogTitle>
              <DialogDescription>
                Policy pack mengikat versi spesifik aturan bisnis untuk memastikan konsistensi audit.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePack} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nama Pack</Label>
                <Input 
                  required 
                  placeholder="Contoh: Kepatuhan PDN 2024" 
                  value={newPack.packName} 
                  onChange={e => setNewPack(s => ({ ...s, packName: e.target.value }))} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Regim Kepatuhan</Label>
                  <Input 
                    required 
                    placeholder="Contoh: UMUM, KHUSUS" 
                    value={newPack.regimeType} 
                    onChange={e => setNewPack(s => ({ ...s, regimeType: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Versi</Label>
                  <Input 
                    required 
                    className="font-mono text-primary"
                    placeholder="1.0.0" 
                    value={newPack.version} 
                    onChange={e => setNewPack(s => ({ ...s, version: e.target.value }))} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <textarea 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  placeholder="Penjelasan tujuan pack ini..."
                  value={newPack.description || ""}
                  onChange={e => setNewPack(s => ({ ...s, description: e.target.value }))}
                />
              </div>
              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button type="submit" disabled={createPack.isPending}>
                  {createPack.isPending ? "Menyimpan..." : "Simpan Pack"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {isLoadingPacks ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">Memuat data...</div>
        ) : packs.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg text-muted-foreground bg-secondary/10">
            <Archive className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p>Belum ada policy pack.</p>
          </div>
        ) : (
          packs.map((pack) => (
            <div 
              key={pack.id} 
              className="flex flex-col bg-card border border-border/50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
              onClick={() => {
                setSelectedPack(pack);
                setIsViewOpen(true);
              }}
            >
              <div className="p-5 border-b border-border/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                <div className="flex justify-between items-start mb-4">
                  {getStatusBadge(pack.status)}
                  <span className="text-xs font-mono font-bold bg-secondary px-2 py-1 rounded">v{pack.version}</span>
                </div>
                <h3 className="font-bold text-lg mb-1 leading-tight group-hover:text-primary transition-colors">{pack.packName}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                  {pack.description || "Tidak ada deskripsi."}
                </p>
              </div>
              <div className="p-4 bg-secondary/5 flex justify-between items-center text-xs text-muted-foreground">
                <div className="flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 opacity-70" />
                  {pack.rules?.length || 0} Aturan
                </div>
                <div className="flex items-center">
                  {pack.publishedAt ? format(new Date(pack.publishedAt), 'dd MMM yyyy') : 'Belum rilis'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* View & Manage Pack Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPack && (
            <>
              <DialogHeader className="mb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl flex items-center gap-3">
                      {selectedPack.packName}
                      {getStatusBadge(selectedPack.status)}
                    </DialogTitle>
                    <DialogDescription className="mt-1.5 flex items-center gap-4">
                      <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">v{selectedPack.version}</span>
                      <span>Regim: {selectedPack.regimeType}</span>
                    </DialogDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedPack.status === "DRAFT" && (
                      <Button size="sm" variant="outline" className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10" onClick={() => handleTransition(selectedPack.id, "REVIEWED")}>
                        <ChevronRight className="w-4 h-4 mr-2" /> Ajukan Review
                      </Button>
                    )}
                    {selectedPack.status === "REVIEWED" && (
                      <Button size="sm" variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => handleTransition(selectedPack.id, "PUBLISHED")}>
                        <Zap className="w-4 h-4 mr-2" /> Publish Pack
                      </Button>
                    )}
                    {selectedPack.status === "PUBLISHED" && (
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleTransition(selectedPack.id, "RETIRED")}>
                        <Ban className="w-4 h-4 mr-2" /> Pensiunkan
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {selectedPack.status === "PUBLISHED" && (
                <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-md text-sm flex items-start gap-3 mb-6">
                  <Lock className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block mb-0.5">Policy Pack ini bersifat Read-Only</strong>
                    Telah di-publish pada {selectedPack.publishedAt ? format(new Date(selectedPack.publishedAt), 'dd MMM yyyy, HH:mm') : '-'} oleh {selectedPack.publishedBy}. Aturan di dalamnya tidak dapat diubah lagi untuk menjamin integritas audit.
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold flex items-center">
                    <Layers className="w-5 h-5 mr-2 text-primary" />
                    Daftar Aturan Bisnis ({selectedPack.rules?.length || 0})
                  </h3>
                  
                  {selectedPack.status === "DRAFT" && (
                    <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="secondary"><Plus className="w-4 h-4 mr-2" /> Tambah Aturan</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Tambahkan Aturan ke Pack</DialogTitle>
                          <DialogDescription>Pilih aturan bisnis yang akan diterapkan pada policy pack ini.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddRule} className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Aturan Bisnis</Label>
                            <select 
                              required
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              value={newRuleRef.businessRuleId}
                              onChange={e => setNewRuleRef(r => ({ ...r, businessRuleId: e.target.value }))}
                            >
                              <option value="" disabled>Pilih aturan bisnis...</option>
                              {rules.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.ruleKey} (v{r.version}) - {r.sourceTitle}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2 pt-2">
                            <Label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-input bg-background text-primary"
                                checked={newRuleRef.isMandatory}
                                onChange={e => setNewRuleRef(r => ({ ...r, isMandatory: e.target.checked }))}
                              />
                              Bersifat Wajib (Mandatory)
                            </Label>
                            <p className="text-xs text-muted-foreground ml-6">Jika wajib, kegagalan evaluasi ini akan menyebabkan paket pengadaan non-compliant.</p>
                          </div>
                          <div className="flex justify-end pt-4 border-t border-border/50">
                            <Button type="submit" disabled={addRule.isPending}>
                              {addRule.isPending ? "Menyimpan..." : "Tambahkan"}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                <div className="rounded-md border border-border/50 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/30 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Rule Key</th>
                        <th className="px-4 py-3 font-medium text-center">Versi</th>
                        <th className="px-4 py-3 font-medium text-center">Tipe</th>
                        <th className="px-4 py-3 font-medium text-center">Snapshot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 bg-card">
                      {!selectedPack.rules || selectedPack.rules.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                            Belum ada aturan yang dimasukkan.
                          </td>
                        </tr>
                      ) : (
                        selectedPack.rules.map((r, i) => (
                          <tr key={i} className="hover:bg-secondary/10">
                            <td className="px-4 py-3 font-mono text-primary font-medium">{r.ruleKey}</td>
                            <td className="px-4 py-3 text-center">v{r.ruleVersion}</td>
                            <td className="px-4 py-3 text-center">
                              {r.isMandatory ? (
                                <Badge variant="default" className="bg-destructive hover:bg-destructive text-destructive-foreground text-[10px] px-1.5 h-5">Wajib</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 h-5">Opsional</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.snapshotLocked ? <Lock className="w-3.5 h-3.5 mx-auto text-muted-foreground" /> : <Unlock className="w-3.5 h-3.5 mx-auto text-muted-foreground" />}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLegalSources,
  useCreateLegalSource,
  useUpdateLegalSource,
  useCreateProvision,
  getListLegalSourcesQueryKey,
  type LegalSource,
  type LegalSourceInput,
  type ProvisionInput,
  LegalSourceVerificationStatus,
  LegalSourceUpdateVerificationStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Search, ArrowRight, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function SourcesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sources = [], isLoading } = useListLegalSources();
  
  const createSource = useCreateLegalSource();
  const updateSource = useUpdateLegalSource();
  const createProvision = useCreateProvision();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<LegalSource | null>(null);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredSources = sources.filter((source) =>
    `${source.regulationCode} ${source.title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  // Form states
  const [newSource, setNewSource] = useState<Partial<LegalSourceInput>>({
    regulationCode: "",
    regulationType: "UU",
    number: "",
    year: new Date().getFullYear(),
    title: "",
    issuingAuthority: "",
    authorityLevel: 1,
    isBinding: true,
  });

  const [newProvision, setNewProvision] = useState<Partial<ProvisionInput>>({
    articleNumber: "",
    provisionType: "OBLIGATION",
    rawText: "",
    sourceCategory: "GENERAL",
  });

  const handleCreateSource = (e: React.FormEvent) => {
    e.preventDefault();
    createSource.mutate(
      { data: newSource as LegalSourceInput },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLegalSourcesQueryKey() });
          setIsCreateOpen(false);
          toast({ title: "Berhasil", description: "Sumber hukum baru telah ditambahkan." });
          setNewSource({
            regulationCode: "",
            regulationType: "UU",
            number: "",
            year: new Date().getFullYear(),
            title: "",
            issuingAuthority: "",
            authorityLevel: 1,
            isBinding: true,
          });
        },
        onError: (err: any) => {
          toast({
            title: "Gagal",
            description: err?.data?.error || "Gagal menambahkan sumber hukum.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUpdateVerification = (id: string, status: LegalSourceUpdateVerificationStatus) => {
    updateSource.mutate(
      { id, data: { verificationStatus: status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLegalSourcesQueryKey() });
          toast({ title: "Berhasil", description: `Status verifikasi diperbarui menjadi ${status}.` });
          if (selectedSource) {
            setSelectedSource(prev => prev ? { ...prev, verificationStatus: status as LegalSourceVerificationStatus } : null);
          }
        },
        onError: (err: any) => {
          toast({
            title: "Gagal",
            description: err?.data?.error || "Gagal memperbarui status verifikasi.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleCreateProvision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource) return;
    
    createProvision.mutate(
      { id: selectedSource.id, data: newProvision as ProvisionInput },
      {
        onSuccess: (provision) => {
          queryClient.invalidateQueries({ queryKey: getListLegalSourcesQueryKey() });
          setSelectedSource((current) =>
            current
              ? { ...current, provisions: [...current.provisions, provision] }
              : current,
          );
          setIsProvisionOpen(false);
          toast({ title: "Berhasil", description: "Pasal baru telah ditambahkan ke sumber hukum." });
          setNewProvision({
            articleNumber: "",
            provisionType: "OBLIGATION",
            rawText: "",
            sourceCategory: "GENERAL",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Gagal",
            description: err?.data?.error || "Gagal menambahkan pasal.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</Badge>;
      case "REJECTED":
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Unverified</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau judul regulasi..."
            className="pl-9 bg-card border-border/50"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Tambah Sumber Hukum</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Sumber Hukum Baru</DialogTitle>
              <DialogDescription>Masukkan detail regulasi untuk dicatat dalam sistem.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSource} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kode Regulasi</Label>
                  <Input 
                    required 
                    placeholder="Contoh: PERPRES-12-2021" 
                    value={newSource.regulationCode} 
                    onChange={e => setNewSource(s => ({ ...s, regulationCode: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipe</Label>
                  <Input 
                    required 
                    placeholder="Contoh: PERPRES" 
                    value={newSource.regulationType} 
                    onChange={e => setNewSource(s => ({ ...s, regulationType: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nomor</Label>
                  <Input 
                    required 
                    placeholder="Contoh: 12" 
                    value={newSource.number} 
                    onChange={e => setNewSource(s => ({ ...s, number: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tahun</Label>
                  <Input 
                    type="number" 
                    required 
                    value={newSource.year ?? ""}
                    onChange={e => setNewSource(s => ({ ...s, year: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Judul</Label>
                  <Input 
                    required 
                    placeholder="Judul lengkap regulasi" 
                    value={newSource.title} 
                    onChange={e => setNewSource(s => ({ ...s, title: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Otoritas Penerbit</Label>
                  <Input 
                    required 
                    placeholder="Contoh: Presiden RI" 
                    value={newSource.issuingAuthority} 
                    onChange={e => setNewSource(s => ({ ...s, issuingAuthority: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Level Otoritas</Label>
                  <Input 
                    type="number" 
                    required 
                    value={newSource.authorityLevel ?? ""}
                    onChange={e => setNewSource(s => ({ ...s, authorityLevel: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createSource.isPending}>
                  {createSource.isPending ? "Menyimpan..." : "Simpan Sumber Hukum"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border/50 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-secondary/30 uppercase border-b border-border/50">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Judul</th>
                <th className="px-4 py-3 font-medium">Otoritas</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Memuat data...</td>
                </tr>
              ) : filteredSources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Belum ada sumber hukum.</td>
                </tr>
              ) : (
                filteredSources.map((source) => (
                  <tr key={source.id} className="hover:bg-secondary/10 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary">{source.regulationCode}</td>
                    <td className="px-4 py-3 max-w-[300px] truncate" title={source.title}>{source.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{source.issuingAuthority}</td>
                    <td className="px-4 py-3">{getStatusBadge(source.verificationStatus)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedSource(source);
                          setIsViewOpen(true);
                        }}
                      >
                        Detail <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedSource && (
            <>
              <DialogHeader className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedSource.regulationCode}</DialogTitle>
                    <DialogDescription className="mt-1.5">{selectedSource.title}</DialogDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedSource.verificationStatus !== "VERIFIED" && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10"
                        onClick={() => handleUpdateVerification(selectedSource.id, "VERIFIED")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Verifikasi
                      </Button>
                    )}
                    {selectedSource.verificationStatus === "UNVERIFIED" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-destructive border-destructive/20 hover:bg-destructive/10"
                        onClick={() => handleUpdateVerification(selectedSource.id, "REJECTED")}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Tolak
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 rounded-lg bg-secondary/20 border border-border/50">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Tipe & Nomor</div>
                  <div className="font-medium">{selectedSource.regulationType} No. {selectedSource.number}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Tahun</div>
                  <div className="font-medium">{selectedSource.year}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Otoritas</div>
                  <div className="font-medium">{selectedSource.issuingAuthority}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Status Verifikasi</div>
                  <div>{getStatusBadge(selectedSource.verificationStatus)}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-primary" />
                    Daftar Pasal ({selectedSource.provisions?.length || 0})
                  </h3>
                  <Dialog open={isProvisionOpen} onOpenChange={setIsProvisionOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="secondary"><Plus className="w-4 h-4 mr-2" /> Tambah Pasal</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Tambah Pasal</DialogTitle>
                        <DialogDescription>Tambahkan teks pasal yang akan menjadi dasar aturan bisnis.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateProvision} className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Nomor Pasal/Ayat</Label>
                          <Input 
                            required 
                            placeholder="Contoh: Pasal 4 ayat (1)" 
                            value={newProvision.articleNumber} 
                            onChange={e => setNewProvision(p => ({ ...p, articleNumber: e.target.value }))} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipe Ketentuan</Label>
                          <select 
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            value={newProvision.provisionType}
                            onChange={e => setNewProvision(p => ({ ...p, provisionType: e.target.value }))}
                          >
                            <option value="OBLIGATION">Kewajiban</option>
                            <option value="PROHIBITION">Larangan</option>
                            <option value="PERMISSION">Izin</option>
                            <option value="DEFINITION">Definisi</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Teks Asli</Label>
                          <textarea 
                            required
                            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            placeholder="Salin teks asli pasal di sini..."
                            value={newProvision.rawText}
                            onChange={e => setNewProvision(p => ({ ...p, rawText: e.target.value }))}
                          />
                        </div>
                        <div className="flex justify-end pt-4">
                          <Button type="submit" disabled={createProvision.isPending}>
                            {createProvision.isPending ? "Menyimpan..." : "Simpan Pasal"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {selectedSource.provisions && selectedSource.provisions.length > 0 ? (
                    selectedSource.provisions.map((prov) => (
                      <Card key={prov.id} className="bg-background border-border/50 shadow-sm">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                          <CardTitle className="text-sm font-bold">{prov.articleNumber}</CardTitle>
                          <Badge variant="outline" className="text-xs font-mono">{prov.provisionType}</Badge>
                        </CardHeader>
                        <CardContent className="py-3 px-4 pt-0 text-sm text-muted-foreground">
                          {prov.rawText}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-md">
                      Belum ada pasal yang dicatat untuk sumber hukum ini.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

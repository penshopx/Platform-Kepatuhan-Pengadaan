import { useState } from "react";
import { Link } from "wouter";
import { useListPackages, useCreatePackage, getListPackagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Search, 
  Plus, 
  Filter, 
  ArrowRight,
  Loader2,
  Calendar,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Fallback values for missing ui components, simulating shadcn components directly
function Badge({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: string, className?: string }) {
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground border-transparent",
    secondary: "bg-secondary text-secondary-foreground border-transparent",
    outline: "border-border text-foreground",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    destructive: "bg-destructive text-destructive-foreground border-transparent",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}

export default function Packages() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: packages, isLoading } = useListPackages({
    search: search || undefined,
    status: status || undefined
  });

  const createPkg = useCreatePackage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        toast({ title: "Paket berhasil dibuat" });
        setIsCreating(false);
      },
      onError: () => {
        toast({ title: "Paket gagal dibuat", variant: "destructive" });
      }
    }
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPkg.mutate({
      data: {
        title: formData.get("title") as string,
        agency: formData.get("agency") as string,
        method: formData.get("method") as string,
        budget: Number(formData.get("budget")),
        owner: formData.get("owner") as string,
        dueDate: new Date().toISOString(),
      }
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'success';
      case 'in_progress':
      case 'review': return 'warning';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Paket Pengadaan</h1>
          <p className="text-muted-foreground">Kelola dan pantau seluruh aktivitas pengadaan.</p>
        </header>
        
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm inline-flex items-center gap-2 cursor-pointer active-elevate transition-all"
        >
          <Plus className="w-4 h-4" />
          Paket Baru
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari berdasarkan kode atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-input rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-card border border-input rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Persiapan">Persiapan</option>
            <option value="Reviu">Reviu</option>
            <option value="Pelaksanaan">Pelaksanaan</option>
            <option value="Selesai">Selesai</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-xl"></div>
          ))}
        </div>
      ) : packages?.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">Paket tidak ditemukan</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4 max-w-sm">
            Tidak ada paket yang sesuai dengan pencarian. Ubah filter atau buat paket baru.
          </p>
          <button 
            onClick={() => { setSearch(""); setStatus(""); }}
            className="text-primary hover:underline text-sm font-medium cursor-pointer"
          >
            Hapus filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {packages?.map(pkg => (
            <Link key={pkg.id} href={`/packages/${pkg.id}`}>
              <div className="group bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all rounded-xl p-6 cursor-pointer flex flex-col h-full hover-elevate">
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="secondary" className="font-mono">{pkg.code}</Badge>
                  <Badge variant={getStatusVariant(pkg.status)}>
                    {pkg.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">{pkg.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-1">{pkg.agency}</p>
                
                <div className="mt-auto pt-4 border-t border-border grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Anggaran</p>
                    <p className="font-mono text-sm font-semibold">
                      {new Intl.NumberFormat('id-ID', { notation: "compact", maximumFractionDigits: 1 }).format(pkg.budget)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Kepatuhan</p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${pkg.compliance >= 90 ? 'bg-emerald-500' : pkg.compliance >= 70 ? 'bg-amber-500' : 'bg-destructive'}`} 
                          style={{ width: `${pkg.compliance}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-medium">{pkg.compliance}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Tenggat {format(new Date(pkg.dueDate), 'dd/MM/yyyy')}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Simple Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border shadow-lg rounded-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={handleCreate}>
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-bold">Buat Paket</h2>
                <p className="text-sm text-muted-foreground mt-1">Tambahkan paket pengadaan baru ke ruang kerja.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Paket</label>
                  <input required name="title" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Nama paket" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Instansi</label>
                    <input required name="agency" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Nama instansi" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Metode</label>
                    <select required name="method" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                      <option value="e-purchasing">e-Purchasing</option>
                      <option value="tender">Tender</option>
                      <option value="Pengadaan Langsung">Pengadaan Langsung</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Anggaran (Rp)</label>
                    <input required name="budget" type="number" min="0" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" placeholder="1000000000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Penanggung Jawab (PPK)</label>
                    <input required name="owner" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Nama PPK" />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/30">
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md hover:bg-secondary transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={createPkg.isPending}
                  className="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium rounded-md hover:bg-primary/90 transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {createPkg.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Buat Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

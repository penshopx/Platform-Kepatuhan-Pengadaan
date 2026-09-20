import { useParams, Link } from "wouter";
import { useGetPackage, useUpdatePackage, getGetPackageQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  User, 
  Building2, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Briefcase,
  ChevronRight,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PackageComplianceEvaluation } from "@/components/package-compliance-evaluation";

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

export default function PackageDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pkg, isLoading, isError } = useGetPackage(id, {
    query: {
      enabled: !isNaN(id),
      queryKey: getGetPackageQueryKey(id)
    }
  });

  const updatePkg = useUpdatePackage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPackageQueryKey(id) });
        toast({ title: "Paket berhasil diperbarui" });
      }
    }
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 space-y-8 animate-pulse max-w-5xl mx-auto">
        <div className="h-6 w-24 bg-muted rounded"></div>
        <div className="h-12 w-3/4 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-48 bg-muted rounded-xl md:col-span-2"></div>
          <div className="h-48 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (isError || !pkg) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-8 h-8 mb-2" />
          <h3 className="font-semibold">Paket tidak ditemukan</h3>
          <p className="text-sm opacity-80 mt-1">The package you're looking for doesn't exist or you don't have access.</p>
          <Link href="/packages" className="mt-4 px-4 py-2 bg-background border border-border text-foreground rounded-md text-sm font-medium hover:bg-secondary cursor-pointer">
            Kembali ke Daftar Paket
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
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
  
  const getStepIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'current': return <Clock className="w-5 h-5 text-amber-500" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
    }
  };

  const handleStatusAdvance = () => {
    // Determine next status roughly
    const nextStatus = pkg.status === 'draft' ? 'in_progress' : 
                      pkg.status === 'in_progress' ? 'review' : 
                      pkg.status === 'review' ? 'completed' : pkg.status;
                      
    if (nextStatus !== pkg.status) {
      updatePkg.mutate({
        id,
        data: { status: nextStatus }
      });
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
      <Link href="/packages" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
        <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
        Kembali ke Daftar Paket
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="secondary" className="font-mono text-sm px-3 py-1">{pkg.code}</Badge>
            <Badge variant={getStatusVariant(pkg.status)} className="px-3 py-1 uppercase tracking-wider text-[10px]">
              {pkg.status.replace('_', ' ')}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">{pkg.title}</h1>
          <p className="text-lg text-muted-foreground mt-2">{pkg.description}</p>
        </div>
        
        {pkg.status !== 'completed' && pkg.status !== 'cancelled' && (
          <button
            onClick={handleStatusAdvance}
            disabled={updatePkg.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-md font-medium text-sm inline-flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap active-elevate shrink-0"
          >
            Lanjutkan Status
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-6 pb-4 border-b border-border flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Detail Paket
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Building2 className="w-4 h-4" /> Instansi
                </div>
                <p className="font-medium">{pkg.agency}</p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <User className="w-4 h-4" /> Penanggung Jawab (PPK)
                </div>
                <p className="font-medium">{pkg.owner}</p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <FileText className="w-4 h-4" /> Metode
                </div>
                <p className="font-medium capitalize">{pkg.method}</p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" /> Due Date
                </div>
                <p className="font-medium">{format(new Date(pkg.dueDate), 'MMMM d, yyyy')}</p>
              </div>
              
              <div className="sm:col-span-2 pt-4 border-t border-border mt-2">
                <div className="flex justify-between items-end mb-2">
                  <div className="text-sm text-muted-foreground">Compliance Score</div>
                  <div className="text-2xl font-mono font-bold">{pkg.compliance}%</div>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out ${pkg.compliance >= 90 ? 'bg-emerald-500' : pkg.compliance >= 70 ? 'bg-amber-500' : 'bg-destructive'}`} 
                    style={{ width: `${pkg.compliance}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-secondary/20">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Dokumen
              </h2>
            </div>
            
            <div className="divide-y divide-border">
              {pkg.documents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Belum ada dokumen</div>
              ) : (
                pkg.documents.map((doc, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-secondary rounded-lg text-primary">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{doc.name}</p>
                        <p className="text-xs text-muted-foreground uppercase">{doc.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={doc.status === 'verified' ? 'success' : 'warning'} className="hidden sm:inline-flex">
                        {doc.status}
                      </Badge>
                      <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Anggaran</h2>
            <div className="text-3xl font-mono font-bold tracking-tight text-primary">
              {formatCurrency(pkg.budget)}
            </div>
            <div className="mt-6 pt-6 border-t border-border">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">PDN Target</h2>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-mono font-bold">{pkg.pdnTarget}%</div>
                <div className="text-sm text-muted-foreground">Domestic Component</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-6">Workflow Steps</h2>
            
            <div className="space-y-6">
              {pkg.steps.map((step, i) => (
                <div key={i} className="flex gap-4 relative">
                  {i < pkg.steps.length - 1 && (
                    <div className={`absolute top-6 left-[9px] w-[2px] h-[calc(100%-4px)] ${step.status === 'completed' ? 'bg-emerald-500' : 'bg-border'}`} />
                  )}
                  <div className="mt-0.5 shrink-0 relative z-10 bg-card">
                    {getStepIcon(step.status)}
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(step.date), 'MMM d, yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PackageComplianceEvaluation pkg={pkg} />
    </div>
  );
}

import { useListRegulations } from "@workspace/api-client-react";
import { BookOpen, Search, Filter, AlertCircle, FileText, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function Regulations() {
  const [search, setSearch] = useState("");
  const { data: regulations, isLoading, isError } = useListRegulations();

  const filteredRegulations = regulations?.filter(reg => 
    reg.title.toLowerCase().includes(search.toLowerCase()) || 
    reg.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col gap-2 border-b border-border pb-8">
        <div className="p-3 bg-primary/10 text-primary w-fit rounded-xl mb-2">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Referensi Regulasi</h1>
        <p className="text-muted-foreground text-lg">Peraturan, pedoman, dan kebijakan kepatuhan pengadaan.</p>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cari regulasi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border-2 border-input rounded-xl pl-12 pr-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-destructive/10 text-destructive p-6 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="font-medium">Regulasi gagal dimuat. Silakan coba kembali.</p>
        </div>
      ) : filteredRegulations?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-medium mb-2">Hasil tidak ditemukan</h3>
          <p>Ubah kata kunci pencarian</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRegulations?.map(reg => (
            <div 
              key={reg.id} 
              className="group bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all rounded-xl p-6 cursor-pointer hover-elevate flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider">
                    {reg.type}
                  </span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${reg.status === 'active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {reg.status}
                  </span>
                </div>
                <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{reg.title}</h3>
                <p className="text-muted-foreground">{reg.summary}</p>
              </div>
              <div className="flex items-center justify-between md:flex-col md:items-end gap-4 shrink-0">
                <div className="text-xs text-muted-foreground font-mono">
                  Diperbarui {format(new Date(reg.updatedAt), 'dd/MM/yyyy')}
                </div>
                <button className="text-primary font-medium text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Lihat Ringkasan <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

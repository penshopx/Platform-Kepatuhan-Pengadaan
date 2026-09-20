import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="flex-1 w-full flex items-center justify-center p-6 md:p-10">
      <div className="bg-card border border-border w-full max-w-md mx-4 p-8 rounded-xl shadow-sm text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Halaman Tidak Ditemukan
        </h1>
        <p className="text-muted-foreground mb-8">
          Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.
        </p>
        <Link href="/">
          <div className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-md font-medium text-sm inline-flex items-center gap-2 cursor-pointer transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </div>
        </Link>
      </div>
    </div>
  );
}

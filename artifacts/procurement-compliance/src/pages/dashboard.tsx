import { useGetDashboard } from "@workspace/api-client-react";
import { 
  Package, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  Wallet
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

export default function Dashboard() {
  const { data: dashboard, isLoading, isError } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted rounded-xl"></div>
          ))}
        </div>
        <div className="h-64 bg-muted rounded-xl"></div>
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div className="p-6 md:p-10">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-8 h-8 mb-2" />
          <h3 className="font-semibold">Dashboard gagal dimuat</h3>
          <p className="text-sm opacity-80 mt-1">Silakan muat ulang halaman.</p>
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

  const statCards = [
    {
      title: "Total Paket",
      value: dashboard.totalPackages,
      icon: Package,
      trend: "+12% dibanding bulan lalu",
      color: "text-blue-500"
    },
    {
      title: "Paket Aktif",
      value: dashboard.activePackages,
      icon: Activity,
      trend: "Sedang diproses",
      color: "text-amber-500"
    },
    {
      title: "Reviu Siap",
      value: dashboard.reviewReady,
      icon: CheckCircle,
      trend: "Perlu perhatian",
      color: "text-emerald-500"
    },
    {
      title: "Tingkat Kepatuhan",
      value: `${dashboard.complianceRate}%`,
      icon: TrendingUp,
      trend: "Target 95%",
      color: "text-purple-500"
    }
  ];

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Ringkasan</h1>
        <p className="text-muted-foreground">Pantau kepatuhan dan kondisi paket pengadaan aktif.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg bg-secondary ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
              <h2 className="text-3xl font-mono font-bold mt-1 tracking-tight">{stat.value}</h2>
              <p className="text-xs text-muted-foreground mt-2">{stat.trend}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold tracking-tight">Total Alokasi Anggaran</h3>
              <p className="text-2xl font-mono font-bold">{formatCurrency(dashboard.totalBudget)}</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboard.budgetByMethod}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="label"
                  stroke="none"
                >
                  {dashboard.budgetByMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <h3 className="font-semibold tracking-tight mb-4">Perlu Tindakan</h3>
          <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border border-dashed border-border rounded-lg bg-muted/30">
            {dashboard.reviewReady > 0 ? (
              <>
                <CheckCircle className="w-12 h-12 text-amber-500 mb-3" />
                <h4 className="font-medium text-lg">{dashboard.reviewReady} Paket Menunggu</h4>
                <p className="text-sm text-muted-foreground mt-2">Reviu e-purchasing perlu disahkan sebelum dilanjutkan.</p>
              </>
            ) : (
              <>
                <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
                <h4 className="font-medium text-lg">Semua Sudah Ditangani</h4>
                <p className="text-sm text-muted-foreground mt-2">Tidak ada reviu tertunda saat ini.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

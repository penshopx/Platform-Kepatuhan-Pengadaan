import { Link, useLocation } from "wouter";
import { useTheme } from "./theme-provider";
import {
  LayoutDashboard,
  Package,
  CheckSquare,
  BookOpen,
  ActivitySquare,
  Moon,
  Sun,
  ShieldCheck,
} from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/packages", label: "Paket", icon: Package },
    { href: "/reviews", label: "e-Purchasing", icon: CheckSquare },
    { href: "/regulations", label: "Regulasi", icon: BookOpen },
    { href: "/activity", label: "Aktivitas", icon: ActivitySquare },
    { href: "/legal-admin", label: "Admin Hukum", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <nav className="w-full md:w-64 border-b md:border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 md:p-6 border-b border-border flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="font-bold tracking-tight text-lg">ProComply</span>
        </div>
        
        <div className="flex-1 py-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible px-4 md:px-3 hide-scrollbar">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors whitespace-nowrap text-sm font-medium ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border mt-auto hidden md:block">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md w-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm font-medium cursor-pointer"
            data-testid="toggle-theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            Ganti Tema
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

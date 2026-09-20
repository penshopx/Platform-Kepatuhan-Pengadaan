import { useListActivity } from "@workspace/api-client-react";
import { ActivitySquare, FileEdit, CheckSquare, PlusCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

export default function Activity() {
  const { data: activities, isLoading, isError } = useListActivity();

  const getIcon = (action: string) => {
    switch(action.toLowerCase()) {
      case 'created': return <PlusCircle className="w-5 h-5 text-blue-500" />;
      case 'updated': return <FileEdit className="w-5 h-5 text-amber-500" />;
      case 'approved': 
      case 'completed': return <CheckSquare className="w-5 h-5 text-emerald-500" />;
      case 'flagged': return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default: return <ActivitySquare className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Jejak Audit</h1>
        <p className="text-muted-foreground">Riwayat lengkap aktivitas ruang kerja pengadaan.</p>
      </header>

      {isLoading ? (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-background bg-muted shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 animate-pulse"></div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] h-24 bg-muted rounded-xl animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-destructive/10 text-destructive p-6 rounded-xl text-center">
          Aktivitas gagal dimuat.
        </div>
      ) : (
        <div className="relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
          {activities?.map((activity, index) => (
            <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group mb-8 last:mb-0">
              {/* Timeline dot */}
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-background bg-card shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                {getIcon(activity.action)}
              </div>
              
              {/* Content Card */}
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    activity.tone === 'positive' ? 'bg-emerald-500/10 text-emerald-500' :
                    activity.tone === 'negative' ? 'bg-destructive/10 text-destructive' :
                    'bg-secondary text-secondary-foreground'
                  }`}>
                    {activity.tone}
                  </span>
                </div>
                
                <p className="text-[15px] leading-snug">
                  <span className="font-bold text-foreground">{activity.actor}</span>
                  <span className="text-muted-foreground mx-1">{activity.action.toLowerCase()}</span>
                  <span className="font-bold text-foreground">{activity.target}</span>
                </p>
                {activity.decisionReference && activity.packageId && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Decision reference
                    </p>
                    <code className="block break-all text-xs text-foreground">
                      {activity.decisionReference}
                    </code>
                    <Link
                      href={`/packages/${activity.packageId}?decisionReference=${encodeURIComponent(activity.decisionReference)}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                      data-testid={`link-decision-${activity.decisionReference}`}
                    >
                      Buka keputusan
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

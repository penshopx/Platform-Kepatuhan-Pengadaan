import { useListEpurchasingReviews, useCompleteEpurchasingReview, getListEpurchasingReviewsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  CheckSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  PackageSearch
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Reviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<number | null>(null);

  const { data: reviews, isLoading } = useListEpurchasingReviews();
  
  const completeReview = useCompleteEpurchasingReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEpurchasingReviewsQueryKey() });
        toast({ title: "Butir reviu telah diselesaikan" });
      }
    }
  });

  const activeReview = reviews?.find(r => r.id === selectedReview) || reviews?.[0];

  const handleCompleteItem = (reviewId: number, itemId: number) => {
    completeReview.mutate({
      data: { reviewId, itemId }
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 flex gap-6 animate-pulse max-w-[1400px] mx-auto">
        <div className="w-80 shrink-0 bg-card border border-border rounded-xl h-[calc(100vh-8rem)] p-4 space-y-4">
          <div className="h-8 bg-muted rounded w-3/4"></div>
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-lg"></div>)}
        </div>
        <div className="flex-1 bg-card border border-border rounded-xl h-[calc(100vh-8rem)]"></div>
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-6 text-primary">
          <CheckSquare className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Tidak ada reviu aktif</h2>
        <p className="text-muted-foreground max-w-md">Saat ini tidak ada paket e-purchasing yang perlu direviu.</p>
      </div>
    );
  }

  // Ensure selectedReview is set if not already
  if (selectedReview === null && reviews.length > 0) {
    setSelectedReview(reviews[0].id);
  }

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto flex flex-col md:flex-row gap-6 h-[calc(100vh-2rem)]">
      {/* Sidebar List */}
      <div className="w-full md:w-80 shrink-0 flex flex-col overflow-hidden bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 border-b border-border bg-secondary/10">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-primary" />
            Reviu Aktif
          </h2>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {reviews.map(review => {
            const isSelected = activeReview?.id === review.id;
            const isComplete = review.completed === review.total;
            return (
              <button
                key={review.id}
                onClick={() => setSelectedReview(review.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all cursor-pointer ${
                  isSelected 
                    ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" 
                    : "bg-background border-border hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono font-bold text-muted-foreground">{review.packageCode}</span>
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                </div>
                <h3 className={`font-semibold text-sm line-clamp-2 leading-tight ${isSelected ? 'text-primary' : ''}`}>
                  {review.packageTitle}
                </h3>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${isComplete ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${(review.completed / review.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium font-mono text-muted-foreground">
                    {review.completed}/{review.total}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Review Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-card border border-border rounded-xl shadow-sm">
        {activeReview ? (
          <>
            <div className="p-6 md:p-8 border-b border-border bg-secondary/5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-bold text-muted-foreground mb-2 flex items-center gap-2">
                  {activeReview.packageCode}
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    e-Purchasing
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{activeReview.packageTitle}</h1>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium mb-1">Progres Reviu</div>
                <div className="text-3xl font-mono font-bold text-primary">
                  {Math.round((activeReview.completed / activeReview.total) * 100)}%
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {/* Group items by 'group' property */}
              {Object.entries(
                activeReview.items.reduce((acc, item) => {
                  if (!acc[item.group]) acc[item.group] = [];
                  acc[item.group].push(item);
                  return acc;
                }, {} as Record<string, typeof activeReview.items>)
              ).map(([group, items]) => (
                <div key={group} className="mb-8 last:mb-0">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 pb-2 border-b border-border">
                    {group}
                  </h3>
                  <div className="space-y-3">
                    {items.map(item => (
                      <div 
                        key={item.id} 
                        className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                          item.completed 
                            ? "bg-secondary/20 border-border" 
                            : "bg-background border-border hover:border-primary/40 hover:shadow-sm"
                        }`}
                      >
                        <button
                          disabled={item.completed || completeReview.isPending}
                          onClick={() => handleCompleteItem(activeReview.id, item.id)}
                          className={`mt-0.5 shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed ${
                            item.completed 
                              ? "bg-primary border-primary text-primary-foreground" 
                              : "border-muted-foreground/40 hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-transparent"
                          }`}
                        >
                          {item.completed && <CheckSquare className="w-4 h-4" />}
                        </button>
                        <div className="flex-1">
                          <p className={`font-medium leading-snug ${item.completed ? 'text-muted-foreground line-through opacity-70' : 'text-foreground'}`}>
                            {item.label}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {activeReview.completed === activeReview.total && (
                <div className="mt-8 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-4 text-emerald-600 dark:text-emerald-400">
                  <div className="p-3 bg-emerald-500/20 rounded-full shrink-0">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Reviu Selesai</h4>
                    <p className="text-sm opacity-90">Seluruh pemeriksaan kepatuhan paket telah diverifikasi. Status paket dapat dilanjutkan.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Pilih reviu dari daftar
          </div>
        )}
      </div>
    </div>
  );
}

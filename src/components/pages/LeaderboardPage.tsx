import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight, Trophy, ShieldCheck } from "lucide-react";

type Row = { rank: number; display_name: string; total_points: number; is_me: boolean | null };

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const RANK_STYLE: Record<number, string> = {
  1: "bg-gradient-to-l from-amber-900 to-yellow-900 border-amber-600",
  2: "bg-gradient-to-l from-slate-800 to-slate-900 border-slate-600",
  3: "bg-gradient-to-l from-orange-900 to-amber-900 border-orange-600",
};

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("leaderboard");
        if (!active) return;
        if (error) {
          console.error("[Leaderboard] Leaderboard query failed", error);
          toast.error("خطأ في جلب لوحة الصدارة");
          setRows([]);
        } else {
          setRows(((data ?? []) as Row[]).map((r) => ({ ...r, rank: Number(r.rank) })));
        }
      } catch (err) {
        if (!active) return;
        console.error("[Leaderboard] Leaderboard query exception", err);
        toast.error("حدث خطأ عند جلب لوحة الصدارة");
        setRows([]);
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-900 via-background to-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to="/" className="text-muted-foreground hover:text-foreground shrink-0">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> لوحة الصدارة
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <Card className="p-3 text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          للخصوصية: تظهر الأسماء مختصرة والنقاط فقط، بدون أي تفاصيل عن الحضور أو السلوك.
        </Card>

        {!ready ? (
          <Card className="p-8 text-center text-muted-foreground">جارٍ التحميل...</Card>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">لا توجد نتائج بعد</Card>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div
                key={`${r.rank}-${r.display_name}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  RANK_STYLE[r.rank] ?? "bg-card"
                } ${r.is_me ? "ring-2 ring-primary" : ""}`}
              >
                <span className="w-8 text-center text-lg font-bold">
                  {MEDALS[r.rank] ?? r.rank}
                </span>
                <span className="flex-1 font-medium truncate">
                  {r.display_name}
                  {r.is_me && <span className="text-[10px] text-primary mr-1">(أنت)</span>}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                  {r.total_points} نقطة
                </span>
              </div>
            ))}
          </div>
        )}

        <Card className="p-4 text-xs text-muted-foreground leading-relaxed">
          نظام النقاط: حاضر +1 · نجمة +5 · غائب 0 · نائم -1 · تحدّث -1 · هارب -2 · شاغب -2
        </Card>
      </main>
    </div>
  );
}

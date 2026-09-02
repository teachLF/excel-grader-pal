import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Trophy, Star, Rabbit, Moon, MessageCircle } from "lucide-react";

type Student = { id: string; name: string };
type Ev = { student_id: string; event_type: string };

// نظام النقاط: نجمة +5، مشاغب/نائم/يتحدث -2، حاضر +1، غائب -3
const POINTS: Record<string, number> = {
  star: 5,
  present: 1,
  absent: 0,
  escaped: -2,
  misbehaving: -2,
  sleeping: -1,
  talking: -1,
};

export function pointsFor(studentId: string, events: Ev[]) {
  let total = 0;
  for (const e of events) {
    if (e.student_id !== studentId) continue;
    total += POINTS[e.event_type] ?? 0;
  }
  return total;
}

const COLORS = ["#10b981", "#f43f5e", "#eab308", "#f97316", "#3b82f6", "#a855f7"];

export function ClassStatsDialog({
  open,
  onOpenChange,
  students,
  events,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  students: Student[];
  events: Ev[];
  className: string;
}) {
  const presentCount = new Set(
    events.filter((e) => e.event_type === "present").map((e) => e.student_id),
  ).size;
  const absentCount = new Set(
    events.filter((e) => e.event_type === "absent").map((e) => e.student_id),
  ).size;

  const totals = {
    star: events.filter((e) => e.event_type === "star").length,
    escaped: events.filter((e) => e.event_type === "escaped").length,
    sleeping: events.filter((e) => e.event_type === "sleeping").length,
    talking: events.filter((e) => e.event_type === "talking").length,
    misbehaving: events.filter((e) => e.event_type === "misbehaving").length,
  };

  const attendanceData = [
    { name: "حاضر", value: presentCount, color: "#10b981" },
    { name: "غائب", value: absentCount, color: "#f43f5e" },
    {
      name: "لم يُسجّل",
      value: Math.max(0, students.length - presentCount - absentCount),
      color: "#cbd5e1",
    },
  ].filter((d) => d.value > 0);

  const behaviorData = [
    { name: "نجوم", value: totals.star, color: "#eab308" },
    { name: "هارب", value: totals.escaped, color: "#f97316" },
    { name: "شاغب", value: totals.misbehaving, color: "#ec4899" },
    { name: "نائم", value: totals.sleeping, color: "#3b82f6" },
    { name: "يتحدث", value: totals.talking, color: "#a855f7" },
  ];

  const leaderboard = [...students]
    .map((s) => ({ ...s, points: pointsFor(s.id, events), stars: events.filter((e) => e.student_id === s.id && e.event_type === "star").length }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إحصائيات الفصل: {className}</DialogTitle>
          <DialogDescription>نظرة شاملة على الحضور والسلوك والنقاط</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Attendance pie */}
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold mb-2 text-sm">توزيع الحضور</h3>
            {attendanceData.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">لا توجد بيانات</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={attendanceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label
                  >
                    {attendanceData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Behavior bar */}
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold mb-2 text-sm">إجمالي السلوكيات</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={behaviorData}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {behaviorData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="border rounded-lg p-4 bg-gradient-to-br from-amber-900 to-yellow-900">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> لوحة الشرف (أعلى 10)
          </h3>
          {leaderboard.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">لا يوجد طلاب بعد</div>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((s, i) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md ${
                      i < 3 ? "bg-card shadow-sm border border-amber-400" : "bg-card/60"
                    }`}
                  >
                    <span className="w-7 text-center text-lg font-bold">{medal}</span>
                    <span className="flex-1 font-medium truncate">{s.name}</span>
                    {s.stars > 0 && (
                      <span className="flex items-center gap-0.5 text-yellow-600 text-xs">
                        <Star className="h-3 w-3 fill-yellow-500" /> {s.stars}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        s.points > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : s.points < 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.points > 0 ? `+${s.points}` : s.points} نقطة
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            <Star className="h-3 w-3 inline text-yellow-500" /> +5 ·{" "}
            <Rabbit className="h-3 w-3 inline text-orange-500" /> -2 ·{" "}
            <Moon className="h-3 w-3 inline text-blue-500" /> -1 ·{" "}
            <MessageCircle className="h-3 w-3 inline text-purple-500" /> -1 · شاغب -2 · حاضر +1 · غائب 0
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowRight,
  Download,
  Plus,
  Trash2,
  Star,
  Moon,
  Rabbit,
  MessageCircle,
  X,
  History,
  Mic,
  MicOff,
  Check,
  UserX,
  UserCheck,
  Sparkles,
  BarChart3,
  Printer,
  StickyNote,
  Trophy,
  Laugh,
  Mail,
} from "lucide-react";
import { StudentNotesDialog } from "@/components/dialogs/StudentNotesDialog";
import { ClassStatsDialog, pointsFor } from "@/components/dialogs/ClassStatsDialog";

type Student = {
  id: string;
  name: string;
  order_index: number;
  student_email: string | null;
};

type StudentEvent = {
  id: string;
  student_id: string;
  event_type: string;
  created_at: string;
};

const STATUSES = [
  { key: "star", label: "نجمة", icon: Star, color: "text-yellow-500" },
  { key: "escaped", label: "هارب", icon: Rabbit, color: "text-orange-500" },
  { key: "sleeping", label: "نائم", icon: Moon, color: "text-blue-500" },
  { key: "talking", label: "يتحدث", icon: MessageCircle, color: "text-purple-500" },
  { key: "misbehaving", label: "شاغب", icon: Laugh, color: "text-pink-500" },
] as const;

const ATTENDANCE = {
  present: { label: "حاضر", icon: UserCheck, color: "text-emerald-600" },
  absent: { label: "غائب", icon: UserX, color: "text-rose-600" },
} as const;

function normalizeArabic(s: string) {
  return s
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Levenshtein distance for fuzzy match tolerance
function lev(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length];
}

function tokenMatches(token: string, namePart: string) {
  if (token === namePart) return true;
  if (token.length >= 2 && namePart.length >= 2) {
    if (token.startsWith(namePart) || namePart.startsWith(token)) return true;
  }
  if (namePart.length >= 4 && token.length >= 4) {
    if (token.includes(namePart) || namePart.includes(token)) return true;
    const d = lev(token, namePart);
    const maxLen = Math.max(token.length, namePart.length);
    if (d <= 1) return true;
    if (maxLen >= 6 && d <= 2) return true;
  } else if (namePart.length >= 3 && token === namePart) {
    return true;
  }
  return false;
}

function eventLabel(t: string) {
  return (
    STATUSES.find((s) => s.key === t)?.label ?? ATTENDANCE[t as keyof typeof ATTENDANCE]?.label ?? t
  );
}

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA";
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function ClassPage({ classId }: { classId: string }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [className, setClassName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<StudentEvent[]>([]);
  const [newName, setNewName] = useState("");
  const [historyFor, setHistoryFor] = useState<Student | null>(null);
  const [notesFor, setNotesFor] = useState<Student | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  // Voice attendance
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"absent" | "present">("absent");
  const [transcript, setTranscript] = useState("");
  const [lastMatched, setLastMatched] = useState<string>("");
  const [recognition, setRecognition] = useState<any>(null);
  // Track processed transcript fragments to avoid duplicates within one session
  const [processedKeys] = useState<Set<string>>(() => new Set());
  const studentsRef = useRef<Student[]>([]);
  const eventsRef = useRef<StudentEvent[]>([]);
  const voiceModeRef = useRef<"absent" | "present">("absent");

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const load = async () => {
    try {
      const { data: cls, error: clsError } = await supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .maybeSingle();
      if (clsError) {
        console.error("[ClassPage] Class query failed", clsError);
        toast.error("خطأ في جلب بيانات الفصل");
      } else if (cls) {
        setClassName(cls.name);
      }
      
      const { data, error } = await supabase
        .from("students")
        .select("id,name,order_index,student_email")
        .eq("class_id", classId)
        .order("order_index", { ascending: true });
      if (error) {
        console.error("[ClassPage] Students query failed", error);
        toast.error(error.message);
        setStudents([]);
      } else {
        setStudents(data ?? []);
      }

      const ids = (data ?? []).map((s) => s.id);
      if (ids.length > 0) {
        const { data: ev, error: evError } = await supabase
          .from("student_events")
          .select("id,student_id,event_type,created_at")
          .in("student_id", ids)
          .order("created_at", { ascending: false });
        if (evError) {
          console.error("[ClassPage] Events query failed", evError);
          toast.error("خطأ في جلب الأحداث");
          setEvents([]);
        } else {
          setEvents(ev ?? []);
        }
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.error("[ClassPage] Data loading exception", err);
      toast.error("حدث خطأ عند تحميل البيانات");
    }
  };
      setEvents([]);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user, classId]);

  // ---------- Events helpers ----------
  const countsFor = (studentId: string) => {
    const c: Record<string, number> = {};
    for (const e of events) {
      if (e.student_id === studentId) c[e.event_type] = (c[e.event_type] ?? 0) + 1;
    }
    return c;
  };

  const attendanceFor = (studentId: string): "present" | "absent" | null => {
    for (const e of eventsRef.current) {
      if (e.student_id === studentId) {
        if (e.event_type === "present" || e.event_type === "absent") return e.event_type;
      }
    }
    return null;
  };

  const addEvent = async (student: Student, type: string, silent = false) => {
    if (!user) return;
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    const optimistic: StudentEvent = {
      id: tempId,
      student_id: student.id,
      event_type: type,
      created_at: new Date().toISOString(),
    };
    eventsRef.current = [optimistic, ...eventsRef.current];
    setEvents((p) => [optimistic, ...p]);
    const { data, error } = await supabase
      .from("student_events")
      .insert({
        student_id: student.id,
        user_id: user.id,
        event_type: type,
      })
      .select()
      .single();
    if (error) {
      eventsRef.current = eventsRef.current.filter((e) => e.id !== tempId);
      setEvents((p) => p.filter((e) => e.id !== tempId));
      if (!silent) toast.error(error.message);
      return;
    }
    if (data) {
      eventsRef.current = eventsRef.current.map((e) =>
        e.id === tempId ? (data as StudentEvent) : e,
      );
      setEvents((p) => p.map((e) => (e.id === tempId ? (data as StudentEvent) : e)));
    }
  };

  const deleteEvent = async (id: string) => {
    setEvents((p) => p.filter((e) => e.id !== id));
    const { error } = await supabase.from("student_events").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const addStudent = async () => {
    if (!newName.trim() || !user) return;
    const max = students.reduce((m, s) => Math.max(m, s.order_index), -1);
    const { error } = await supabase.from("students").insert({
      class_id: classId,
      user_id: user.id,
      name: newName.trim(),
      order_index: max + 1,
    });
    if (error) return toast.error(error.message);
    setNewName("");
    load();
  };

  const removeStudent = async (id: string) => {
    if (!confirm("حذف الطالب وكل سوابقه؟")) return;
    await supabase.from("student_events").delete().eq("student_id", id);
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const saveStudentEmail = async (id: string, email: string) => {
    const value = email.trim().toLowerCase();
    const { error } = await supabase
      .from("students")
      .update({ student_email: value === "" ? null : value })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setStudents((p) => p.map((s) => (s.id === id ? { ...s, student_email: value || null } : s)));
    toast.success(value ? "تم ربط بريد الطالبة" : "تم حذف البريد");
  };

  // ---------- Voice attendance ----------
  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("المتصفح لا يدعم التعرف الصوتي. جرّب Chrome.");
      return;
    }
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          for (let a = 0; a < r.length; a++) finalText += " " + r[a].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      const heardText = `${finalText} ${interim}`.trim();
      setTranscript(heardText);
      if (heardText) tryMatchNames(heardText);
    };

    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("يجب السماح بالوصول للميكروفون");
        setListening(false);
      }
    };

    rec.onend = () => {
      // auto-restart while listening
      if ((rec as any).__keepAlive) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };

    (rec as any).__keepAlive = true;
    try {
      rec.start();
      setRecognition(rec);
      setListening(true);
      processedKeys.clear();
      toast.success("الميكروفون مفعّل - انطق اسم الطالب");
    } catch {
      toast.error("تعذّر بدء الاستماع");
    }
  };

  const stopListening = () => {
    if (recognition) {
      (recognition as any).__keepAlive = false;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    }
    setRecognition(null);
    setListening(false);
    setTranscript("");
    processedKeys.clear();
  };

  const speakQueue = (texts: string[]) => {
    try {
      window.speechSynthesis.cancel();
      for (const t of texts) {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = "ar-SA";
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      }
    } catch {
      /* ignore */
    }
  };

  // Match ALL students mentioned in the transcript (supports rapid-fire names)
  const tryMatchNames = (text: string) => {
    const norm = normalizeArabic(text);
    if (!norm) return;
    const tokens = norm.split(" ").filter((t) => t.length >= 2);
    if (tokens.length === 0) return;

    // Build candidate list with first-name parts
    const activeVoiceMode = voiceModeRef.current;
    const candidates = studentsRef.current.map((s) => {
      const n = normalizeArabic(s.name);
      const parts = n.split(" ").filter((p) => p.length >= 2);
      return { student: s, parts, first: parts[0] ?? n };
    });

    const matchedIds = new Set<string>();
    const matchedStudents: Student[] = [];

    // Try each token (and 2-token windows) against student first names
    for (let i = 0; i < tokens.length; i++) {
      const t1 = tokens[i];
      const t2 = i + 1 < tokens.length ? tokens[i + 1] : "";

      for (const c of candidates) {
        if (matchedIds.has(c.student.id)) continue;
        const first = c.first;
        if (!first) continue;

        let hit = false;
        // single-token fuzzy match on first name
        if (tokenMatches(t1, first)) hit = true;
        // two-token concat (some recognizers split names)
        if (!hit && t2 && tokenMatches(t1 + t2, first)) hit = true;
        // also try matching any of the name parts (e.g. last name only)
        if (!hit) {
          for (const p of c.parts) {
            if (tokenMatches(t1, p)) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          matchedIds.add(c.student.id);
          matchedStudents.push(c.student);
        }
      }
    }

    if (matchedStudents.length === 0) return;

    const phrases: string[] = [];
    const namesForToast: string[] = [];
    for (const st of matchedStudents) {
      const key = `${st.id}:${activeVoiceMode}`;
      if (processedKeys.has(key)) continue; // already handled this session
      const current = attendanceFor(st.id);
      if (current !== activeVoiceMode) {
        addEvent(st, activeVoiceMode, true);
      }
      processedKeys.add(key);
      namesForToast.push(st.name);
      const verb = activeVoiceMode === "absent" ? "تم تغييب" : "تم تحضير";
      phrases.push(`${verb} ${st.name}`);
    }
    if (namesForToast.length > 0) {
      setLastMatched(namesForToast.join("، "));
      speakQueue(phrases);
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognition) {
        (recognition as any).__keepAlive = false;
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Export ----------
  const exportXlsx = () => {
    const rows = students.map((s, i) => {
      const att = attendanceFor(s.id);
      const c = countsFor(s.id);
      return {
        "#": i + 1,
        "اسم الطالب": s.name,
        "البريد الإلكتروني": s.student_email ?? "",
        الحضور: att ? ATTENDANCE[att].label : "",
        نجمة: c.star ?? 0,
        هارب: c.escaped ?? 0,
        نائم: c.sleeping ?? 0,
        يتحدث: c.talking ?? 0,
        شاغب: c.misbehaving ?? 0,
        النقاط: pointsFor(s.id, events),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 5 },
      { wch: 30 },
      { wch: 28 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, `${className || "class"}.xlsx`);
  };

  // ---------- Print / PDF ----------
  const printPdf = () => {
    const rows = students
      .map((s, i) => {
        const att = attendanceFor(s.id);
        const c = countsFor(s.id);
        const pts = pointsFor(s.id, events);
        return `
          <tr>
            <td>${i + 1}</td>
            <td style="text-align:right">${s.name}</td>
            <td>${att ? ATTENDANCE[att].label : "-"}</td>
            <td>${c.star ?? 0}</td>
            <td>${c.escaped ?? 0}</td>
            <td>${c.sleeping ?? 0}</td>
            <td>${c.talking ?? 0}</td>
            <td>${c.misbehaving ?? 0}</td>
            <td><b>${pts > 0 ? "+" + pts : pts}</b></td>
          </tr>`;
      })
      .join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
      <title>${className}</title>
      <style>
        body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;padding:24px;color:#0f172a}
        h1{font-size:22px;margin:0 0 4px;color:#4f46e5}
        .sub{color:#64748b;font-size:12px;margin-bottom:16px}
        table{border-collapse:collapse;width:100%;font-size:13px}
        th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:center}
        th{background:#f1f5f9}
        tr:nth-child(even) td{background:#f8fafc}
        .pill{display:inline-block;padding:2px 10px;border-radius:999px;margin-left:6px;font-size:11px}
        .g{background:#d1fae5;color:#065f46}.r{background:#fee2e2;color:#991b1b}.y{background:#fef3c7;color:#92400e}
        @media print{.no-print{display:none}}
      </style></head><body>
      <h1>${className}</h1>
      <div class="sub">
        إجمالي الطلاب: <b>${students.length}</b>
        <span class="pill g">حاضر: ${presentCount}</span>
        <span class="pill r">غائب: ${absentCount}</span>
        <span class="pill y">نجوم: ${totalStars}</span>
        — ${new Date().toLocaleString("ar")}
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>الطالب</th><th>الحضور</th>
          <th>نجمة</th><th>هارب</th><th>نائم</th><th>يتحدث</th><th>شاغب</th><th>النقاط</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="no-print" style="margin-top:16px;text-align:center">
        <button onclick="window.print()" style="padding:10px 24px;font-size:14px;background:#4f46e5;color:#fff;border:0;border-radius:8px;cursor:pointer">طباعة / حفظ PDF</button>
      </div>
      <script>setTimeout(()=>window.print(),300)</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("تعذّر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">...</div>;
  }

  const presentCount = students.filter((s) => attendanceFor(s.id) === "present").length;
  const absentCount = students.filter((s) => attendanceFor(s.id) === "absent").length;
  const totalStars = events.filter((e) => e.event_type === "star").length;

  // Top student (by points) for the crown badge
  const topStudentId =
    students.length > 0
      ? [...students]
          .map((s) => ({ id: s.id, p: pointsFor(s.id, events) }))
          .sort((a, b) => b.p - a.p)[0]
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-background to-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/" className="text-muted-foreground hover:text-foreground shrink-0">
              <ArrowRight className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-bold truncate bg-gradient-to-l from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {className}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              onClick={() => setStatsOpen(true)}
              size="sm"
              variant="outline"
              disabled={students.length === 0}
              title="الإحصائيات"
            >
              <BarChart3 className="h-4 w-4 ml-1" /> إحصائيات
            </Button>
            <Button
              onClick={printPdf}
              size="sm"
              variant="outline"
              disabled={students.length === 0}
              title="طباعة / PDF"
            >
              <Printer className="h-4 w-4 ml-1" /> PDF
            </Button>
            <Button onClick={exportXlsx} size="sm" disabled={students.length === 0}>
              <Download className="h-4 w-4 ml-1" /> Excel
            </Button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-muted">
            الإجمالي: <b>{students.length}</b>
          </span>
          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
            حاضر: <b>{presentCount}</b>
          </span>
          <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700">
            غائب: <b>{absentCount}</b>
          </span>
          <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> نجوم: <b>{totalStars}</b>
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Add + Voice toolbar */}
        <Card className="p-3 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="إضافة طالب"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStudent()}
            />
            <Button onClick={addStudent} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              التحضير الصوتي:
            </div>
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => {
                  setVoiceMode("absent");
                  processedKeys.clear();
                }}
                className={`px-3 py-1 text-xs ${voiceMode === "absent" ? "bg-rose-500 text-white" : "bg-background"}`}
              >
                تغييب
              </button>
              <button
                onClick={() => {
                  setVoiceMode("present");
                  processedKeys.clear();
                }}
                className={`px-3 py-1 text-xs ${voiceMode === "present" ? "bg-emerald-500 text-white" : "bg-background"}`}
              >
                تحضير
              </button>
            </div>
            {!listening ? (
              <Button
                size="sm"
                onClick={startListening}
                disabled={students.length === 0}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90"
              >
                <Mic className="h-4 w-4 ml-1" /> بدء الاستماع
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={stopListening}>
                <MicOff className="h-4 w-4 ml-1" /> إيقاف
              </Button>
            )}
          </div>
          {listening && (
            <div className="rounded-md bg-muted p-2 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-muted-foreground">يستمع...</span>
              </div>
              {transcript && <div className="text-foreground truncate">"{transcript}"</div>}
              {lastMatched && (
                <div className="text-emerald-600 flex items-center gap-1">
                  <Check className="h-3 w-3" /> آخر طالب: <b>{lastMatched}</b>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Student list */}
        <div className="space-y-2">
          {students.map((s, i) => {
            const counts = countsFor(s.id);
            const att = attendanceFor(s.id);
            return (
              <Card
                key={s.id}
                className={`p-3 transition-all ${
                  att === "present"
                    ? "border-l-4 border-l-emerald-500"
                    : att === "absent"
                      ? "border-l-4 border-l-rose-500 opacity-75"
                      : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-1.5">
                      {topStudentId?.id === s.id && topStudentId.p > 0 && (
                        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate">{s.name}</span>
                      {(() => {
                        const pts = pointsFor(s.id, events);
                        if (pts === 0) return null;
                        return (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              pts > 0
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {pts > 0 ? `+${pts}` : pts}
                          </span>
                        );
                      })()}
                    </div>
                    {att && (
                      <div
                        className={`text-xs flex items-center gap-1 mt-0.5 ${ATTENDANCE[att].color}`}
                      >
                        {(() => {
                          const I = ATTENDANCE[att].icon;
                          return <I className="h-3 w-3" />;
                        })()}
                        {ATTENDANCE[att].label}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setHistoryFor(s)}
                    title="السوابق"
                  >
                    <History className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setNotesFor(s)}
                    title="ملاحظات"
                  >
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeStudent(s.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>

                {/* Student email link */}
                <div className="flex items-center gap-1.5 mt-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    dir="ltr"
                    type="email"
                    defaultValue={s.student_email ?? ""}
                    placeholder="بريد الطالبة الإلكتروني"
                    className="h-8 text-xs"
                    onBlur={(e) => {
                      const v = e.target.value.trim().toLowerCase();
                      if (v !== (s.student_email ?? "")) saveStudentEmail(s.id, v);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                </div>

                {/* Attendance */}
                <div className="flex gap-1.5 mt-3">
                  <Button
                    size="sm"
                    variant={att === "present" ? "default" : "outline"}
                    onClick={() => addEvent(s, "present")}
                    className={`h-8 flex-1 ${att === "present" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                  >
                    <UserCheck className="h-3.5 w-3.5 ml-1" /> حاضر
                  </Button>
                  <Button
                    size="sm"
                    variant={att === "absent" ? "default" : "outline"}
                    onClick={() => addEvent(s, "absent")}
                    className={`h-8 flex-1 ${att === "absent" ? "bg-rose-600 hover:bg-rose-700" : ""}`}
                  >
                    <UserX className="h-3.5 w-3.5 ml-1" /> غائب
                  </Button>
                </div>

                {/* Tally buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {STATUSES.map((st) => {
                    const Icon = st.icon;
                    const n = counts[st.key] ?? 0;
                    return (
                      <Button
                        key={st.key}
                        size="sm"
                        variant="outline"
                        onClick={() => addEvent(s, st.key)}
                        className="h-8 relative"
                      >
                        <Icon className={`h-3.5 w-3.5 ml-1 ${st.color}`} />
                        {st.label}
                        {n > 0 && (
                          <span className="mr-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                            {n}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          {students.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">لا يوجد طلاب في هذا الفصل</Card>
          )}
        </div>
      </main>

      {/* History dialog */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>سوابق: {historyFor?.name}</DialogTitle>
            <DialogDescription>كل ما تم تسجيله لهذا الطالب</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-1 -mx-2 px-2">
            {historyFor &&
              (() => {
                const list = events.filter((e) => e.student_id === historyFor.id);
                if (list.length === 0)
                  return (
                    <div className="text-center text-sm text-muted-foreground py-6">
                      لا توجد سوابق بعد
                    </div>
                  );
                return list.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{eventLabel(e.event_type)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("ar", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteEvent(e.id)}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ));
              })()}
          </div>
        </DialogContent>
      </Dialog>

      <StudentNotesDialog
        open={!!notesFor}
        onOpenChange={(o) => !o && setNotesFor(null)}
        studentId={notesFor?.id ?? null}
        studentName={notesFor?.name ?? ""}
      />

      <ClassStatsDialog
        open={statsOpen}
        onOpenChange={setStatsOpen}
        students={students}
        events={events}
        className={className}
      />
    </div>
  );
}

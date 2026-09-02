import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Plus, BookOpen, AlertTriangle, MessageSquare } from "lucide-react";

type Note = {
  id: string;
  body: string;
  kind: string;
  created_at: string;
};

const KINDS = [
  { key: "general", label: "ملاحظة", icon: MessageSquare, color: "text-slate-300 bg-slate-700" },
  { key: "academic", label: "أكاديمي", icon: BookOpen, color: "text-blue-300 bg-blue-900" },
  { key: "behavior", label: "سلوكي", icon: AlertTriangle, color: "text-amber-300 bg-amber-900" },
] as const;

export function StudentNotesDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
}: {
  studentId: string | null;
  studentName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<string>("general");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!studentId) return;
    try {
      const { data, error } = await (supabase as any)
        .from("student_notes")
        .select("id,body,kind,created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[StudentNotes] Notes query failed", error);
        toast.error("خطأ في جلب الملاحظات");
        setNotes([]);
      } else {
        setNotes((data as Note[]) ?? []);
      }
    } catch (err) {
      console.error("[StudentNotes] Notes query exception", err);
      toast.error("حدث خطأ عند جلب الملاحظات");
      setNotes([]);
    }
  };

  useEffect(() => {
    if (open && studentId) load();
    if (!open) {
      setBody("");
      setKind("general");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentId]);

  const add = async () => {
    if (!body.trim() || !user || !studentId) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("student_notes").insert({
        student_id: studentId,
        user_id: user.id,
        body: body.trim(),
        kind,
      });
      if (error) {
        console.error("[StudentNotes] Insert failed", error);
        toast.error(error.message);
      } else {
        setBody("");
        await load();
        toast.success("تم إضافة الملاحظة");
      }
    } catch (err) {
      console.error("[StudentNotes] Insert exception", err);
      toast.error("حدث خطأ عند إضافة الملاحظة");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("student_notes").delete().eq("id", id);
      if (error) {
        console.error("[StudentNotes] Delete failed", error);
        toast.error(error.message);
      } else {
        setNotes((p) => p.filter((n) => n.id !== id));
        toast.success("تم حذف الملاحظة");
      }
    } catch (err) {
      console.error("[StudentNotes] Delete exception", err);
      toast.error("حدث خطأ عند حذف الملاحظة");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>ملاحظات: {studentName}</DialogTitle>
          <DialogDescription>سجّل ملاحظاتك الأكاديمية والسلوكية للطالب</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
          <div className="flex gap-1.5">
            {KINDS.map((k) => {
              const Icon = k.icon;
              const active = kind === k.key;
              return (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all ${
                    active ? k.color + " ring-2 ring-offset-1 ring-current" : "bg-background border"
                  }`}
                >
                  <Icon className="h-3 w-3" /> {k.label}
                </button>
              );
            })}
          </div>
          <Textarea
            placeholder="اكتب الملاحظة..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <Button onClick={add} disabled={busy || !body.trim()} className="w-full">
            <Plus className="h-4 w-4 ml-1" /> حفظ الملاحظة
          </Button>
        </div>

        <div className="overflow-y-auto space-y-2 -mx-2 px-2 mt-2">
          {notes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              لا توجد ملاحظات بعد
            </div>
          ) : (
            notes.map((n) => {
              const k = KINDS.find((x) => x.key === n.kind) ?? KINDS[0];
              const Icon = k.icon;
              return (
                <div key={n.id} className="border rounded-lg p-3 bg-card space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${k.color}`}
                    >
                      <Icon className="h-3 w-3" /> {k.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("ar", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      <Button size="icon" variant="ghost" onClick={() => remove(n.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
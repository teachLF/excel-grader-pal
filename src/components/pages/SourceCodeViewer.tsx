import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowRight, Copy, FileCode, Search, Download } from "lucide-react";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const downloadBlob = (content: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const modules = import.meta.glob(
  [
    "/src/**/*.{ts,tsx,js,jsx,css,html,txt,md,json}",
    "/public/**/*.{txt,xml,json,html,css,js}",
    "/*.{ts,js,json,html,md,txt}",
    "!/src/routeTree.gen.ts",
  ],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;



export function SourceCodeViewer() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (roleLoading || !user) return;
    if (!isAdmin) {
      toast.error("هذه الصفحة للمسؤولين فقط");
      navigate({ to: "/" });
    }
  }, [isAdmin, roleLoading, user, navigate]);

  const files = useMemo(() => Object.keys(modules).sort(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? files.filter((f) => f.toLowerCase().includes(q)) : files;
  }, [files, query]);

  const current = active && modules[active] ? active : filtered[0] ?? null;

  const exportAll = () => {
    const all = files;
    const toc = all
      .map(
        (f) =>
          `<li><a href="#${encodeURIComponent(f)}">${escapeHtml(f)}</a></li>`,
      )
      .join("");
    const body = all
      .map(
        (f) =>
          `<section id="${encodeURIComponent(f)}"><h2>${escapeHtml(f)}</h2><pre><code>${escapeHtml(modules[f])}</code></pre></section>`,
      )
      .join("");
    const plain = all
      .map((f) => `${"=".repeat(70)}\n${f}\n${"=".repeat(70)}\n\n${modules[f]}`)
      .join("\n\n");
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>أكواد teachLF</title><style>body{font-family:system-ui;margin:0;padding:24px;background:#0f172a;color:#e2e8f0}h1{font-size:20px}h2{font-size:14px;direction:ltr;text-align:left;color:#7dd3fc;margin-top:32px}pre{direction:ltr;text-align:left;background:#111827;padding:16px;border-radius:8px;overflow:auto;font-size:12px;line-height:1.6}a{color:#7dd3fc}button{margin:8px 0;padding:8px 14px;border-radius:8px;border:0;background:#0ea5e9;color:#fff;cursor:pointer;font-size:13px}</style></head><body><h1>أكواد الموقع (${all.length} ملف)</h1><button onclick="(function(){var b=new Blob([document.getElementById('raw').textContent],{type:'text/plain;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='teachlf-source.txt';a.click();})()">تحميل نسخة نصية TXT</button><ul style="direction:ltr;text-align:left">${toc}</ul>${body}<script type="text/plain" id="raw">${plain.replace(/<\/script/gi, "<\\/script")}<\/script></body></html>`;
    downloadBlob(html, "teachlf-source.html", "text/html;charset=utf-8");
    toast.success(`تم تصدير ${all.length} ملف في ملف واحد`);
  };



  if (authLoading || roleLoading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center">...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">أكواد الموقع</h1>
            <p className="text-xs text-muted-foreground">{files.length} ملف</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild>
              <a href="/teachlf-single.html" download="teachlf-single.html">
                <Download className="h-4 w-4 ml-1" /> تحميل الموقع كملف HTML واحد يعمل
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={exportAll}>
              <Download className="h-4 w-4 ml-1" /> تحميل الأكواد المصدرية
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowRight className="h-4 w-4 ml-1" /> رجوع
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[280px_1fr] gap-4">
        <Card className="p-3 space-y-2 h-fit lg:sticky lg:top-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن ملف..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          <div className="max-h-[65vh] overflow-auto space-y-1">
            {filtered.map((f) => (
              <button
                key={f}
                onClick={() => setActive(f)}
                dir="ltr"
                className={`w-full text-left text-xs px-2 py-1.5 rounded truncate transition-colors ${
                  current === f ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {f.replace("/src/", "")}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">لا توجد نتائج</p>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs truncate" dir="ltr">
                {current ?? "—"}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!current) return;
                navigator.clipboard.writeText(modules[current]);
                toast.success("تم نسخ الكود");
              }}
            >
              <Copy className="h-4 w-4 ml-1" /> نسخ
            </Button>
          </div>
          <pre
            dir="ltr"
            className="text-left text-xs leading-relaxed overflow-auto max-h-[75vh] p-4 bg-background"
          >
            <code>{current ? modules[current] : ""}</code>
          </pre>
        </Card>
      </main>
    </div>
  );
}

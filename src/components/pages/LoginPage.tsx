import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Chrome, GraduationCap } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    let active = true;
    (async () => {
      let isStudent = false;
      try {
        const { data } = await supabase.rpc("my_student_stats");
        isStudent = Array.isArray(data) && data.length > 0;
      } catch {
        isStudent = false;
      }
      if (!active) return;
      navigate({ to: isStudent ? "/my-stats" : "/" });
    })();
    return () => {
      active = false;
    };
  }, [loading, session, navigate]);


  const reportAccess = async (userId: string, userEmail: string) => {
    const [{ data: profile }, { data: role }] = await Promise.all([
      supabase.from("profiles").select("approved").eq("id", userId).maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);
    if (role) {
      toast.success(`مرحباً ${userEmail} — لديك صلاحية المسؤول، يمكنك فتح /admin`);
    } else if (profile?.approved === false) {
      toast.warning("حسابك قيد المراجعة ولم يُعتمد بعد، ولا يملك صلاحية المسؤول");
    } else {
      toast.info("تم الدخول كحساب معلم عادي — لوحة المسؤول تتطلب صلاحية admin");
    }
  };

  // الطالبة تُوجَّه لصفحتها الخاصة، والمعلمة إلى الدفتر
  const goAfterLogin = async () => {
    try {
      const { data } = await supabase.rpc("my_student_stats");
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        navigate({ to: "/my-stats" });
        return;
      }
    } catch {
      /* تجاهل وتوجيه افتراضي */
    }
    navigate({ to: "/" });
  };


  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { error: profileError } = await supabase.rpc("ensure_my_profile");
          if (profileError) throw profileError;
          await reportAccess(data.user.id, data.user.email ?? email);
        }
      }
      await goAfterLogin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };


  const signInWithGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await goAfterLogin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const signInWithMicrosoft = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("microsoft", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await goAfterLogin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const signInWithApple = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await goAfterLogin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-brand-gradient">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-accent-strong/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary/40 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md p-8 backdrop-blur-xl bg-card/90 border-primary/20 shadow-glow">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3 grid place-items-center h-14 w-14 rounded-2xl bg-accent-gradient text-primary-foreground shadow-elegant">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            متابعة <span className="text-gradient">الطلاب</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "سجّل دخولك للمتابعة" : "أنشئ حساباً جديداً"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-background/60"
            />
          </div>
          <Button type="submit" className="w-full bg-accent-gradient hover:opacity-90 shadow-elegant" disabled={busy}>
            {busy ? "..." : mode === "signin" ? "دخول" : "إنشاء حساب"}
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">أو</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            className="w-full h-14 text-base font-bold bg-primary/80 text-primary-foreground hover:bg-primary shadow-elegant"
            disabled={busy}
            onClick={signInWithMicrosoft}
          >
            <svg className="ml-2 h-5 w-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="1" y="1" width="10" height="10" fill="#F25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
              <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
            </svg>
            الدخول بحساب مايكروسوفت (حساب المدرسة)
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full bg-background/60"
            disabled={busy}
            onClick={signInWithGoogle}
          >
            <Chrome className="ml-2 h-4 w-4" />
            الدخول بحساب Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full bg-background/60"
            disabled={busy}
            onClick={signInWithApple}
          >
            <svg
              className="ml-2 h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            الدخول بحساب Apple
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full mt-5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "signin" ? "ليس لديك حساب؟ سجّل الآن" : "لديك حساب؟ سجّل دخولك"}
        </button>
      </Card>
    </div>
  );
}
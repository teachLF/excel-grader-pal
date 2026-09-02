import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogIn, Loader2 } from "lucide-react";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [approved, setApproved] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setApproved(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("approved")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) return;
        if (error) {
          console.error("[AdminGuard] Profile query failed", error);
        }
        setApproved(data?.approved ?? false);
      } catch (err) {
        if (!active) return;
        console.error("[AdminGuard] Profile query exception", err);
        setApproved(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Blocked
        title="يلزم تسجيل الدخول"
        reason="هذه الصفحة مخصّصة للمسؤولين، ولا توجد جلسة دخول حالية."
        action={
          <Button asChild>
            <Link to="/login">
              <LogIn className="h-4 w-4 ml-1" /> تسجيل الدخول
            </Link>
          </Button>
        }
      />
    );
  }

  if (!isAdmin) {
    return (
      <Blocked
        title="لا تملك صلاحية المسؤول"
        reason={
          approved === false
            ? `الحساب ${user.email ?? ""} غير معتمد بعد (approved = false) ولا يملك صلاحية admin في جدول الصلاحيات.`
            : `الحساب ${user.email ?? ""} لا يملك صلاحية admin في جدول الصلاحيات (user_roles).`
        }
        action={
          <Button variant="outline" asChild>
            <Link to="/">العودة للرئيسية</Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}

function Blocked({
  title,
  reason,
  action,
}: {
  title: string;
  reason: string;
  action: ReactNode;
}) {
  return (
    <div className="min-h-screen grid place-items-center p-4 bg-muted/30">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto grid place-items-center h-14 w-14 rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed" dir="auto">
          {reason}
        </p>
        <div className="pt-2">{action}</div>
      </Card>
    </div>
  );
}

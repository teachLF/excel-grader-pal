import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const applySession = async (nextSession: Session | null) => {
      if (nextSession) {
        // أكمل إنشاء الملف والدور قبل أن تبدأ الشاشات بطلب بيانات المستخدم.
        try {
          const { error: profileError } = await supabase.rpc("ensure_my_profile");
          if (profileError) {
            console.error("[Auth] Profile bootstrap failed", profileError);
            if (!active) return;
            setError(profileError.message);
          }
        } catch (err) {
          console.error("[Auth] Profile bootstrap exception", err);
          if (!active) return;
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      }
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      // تنفيذ الطلب خارج callback يمنع تعارض قفل جلسة المصادقة.
      window.setTimeout(() => void applySession(s), 0);
    });
    void supabase.auth.getSession().then(({ data }) => applySession(data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading, error };
}
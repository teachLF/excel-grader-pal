import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!active) return;
        if (queryError) {
          console.error("[Admin] Role query failed", queryError);
          setError(queryError.message);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
          setError(null);
        }
        setLoading(false);
      } catch (err) {
        if (!active) return;
        console.error("[Admin] Role query exception", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsAdmin(false);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading, error };
}
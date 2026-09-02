import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const FREE_CLASS_LIMIT = 2;
export const FREE_STUDENT_LIMIT = 25;

export function usePlus() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [isPlus, setIsPlus] = useState(false);
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setIsPlus(false);
      setRequested(false);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("is_plus, plus_requested")
      .eq("id", user.id)
      .maybeSingle();
    if (error) console.error("[usePlus] Profile query failed", error);
    setIsPlus(!!data?.is_plus);
    setRequested(!!data?.plus_requested);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const requestPlus = async () => {
    const { error } = await supabase.rpc("request_plus");
    if (error) throw error;
    setRequested(true);
  };

  const hasPlus = isPlus || isAdmin;
  return {
    isPlus,
    hasPlus,
    requested,
    requestPlus,
    refresh: load,
    loading: loading || authLoading || adminLoading,
  };
}

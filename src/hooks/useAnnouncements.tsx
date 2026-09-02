import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Announcement = {
  id: string;
  title: string;
  description: string;
  media_type: "video" | "image";
  media_url: string;
  skip_delay_seconds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[useAnnouncements] Failed to load announcements", error);
      } else {
        setAnnouncements(data ?? []);
      }
    } catch (err) {
      console.error("[useAnnouncements] Exception loading announcements", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async (announcement: Omit<Announcement, "id" | "created_at" | "updated_at">) => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .insert([announcement])
        .select()
        .single();

      if (error) {
        console.error("[useAnnouncements] Failed to add announcement", error);
        toast.error("خطأ في إضافة الإعلان");
        return null;
      }

      setAnnouncements([data, ...announcements]);
      toast.success("تم إضافة الإعلان بنجاح");
      return data;
    } catch (err) {
      console.error("[useAnnouncements] Exception adding announcement", err);
      toast.error("حدث خطأ عند إضافة الإعلان");
      return null;
    }
  };

  const update = async (id: string, updates: Partial<Announcement>) => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("[useAnnouncements] Failed to update announcement", error);
        toast.error("خطأ في تحديث الإعلان");
        return null;
      }

      setAnnouncements(announcements.map(a => a.id === id ? data : a));
      toast.success("تم تحديث الإعلان بنجاح");
      return data;
    } catch (err) {
      console.error("[useAnnouncements] Exception updating announcement", err);
      toast.error("حدث خطأ عند تحديث الإعلان");
      return null;
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("[useAnnouncements] Failed to delete announcement", error);
        toast.error("خطأ في حذف الإعلان");
        return false;
      }

      setAnnouncements(announcements.filter(a => a.id !== id));
      toast.success("تم حذف الإعلان بنجاح");
      return true;
    } catch (err) {
      console.error("[useAnnouncements] Exception deleting announcement", err);
      toast.error("حدث خطأ عند حذف الإعلان");
      return false;
    }
  };

  return { announcements, loading, add, update, remove, reload: load };
}

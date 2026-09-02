import { supabase } from "@/integrations/supabase/client";

export const ANNOUNCEMENTS_BUCKET = "announcements";

/** Returns a browser-usable URL for stored media (signed for storage paths, passthrough for http URLs). */
export async function resolveMediaUrl(mediaUrl: string): Promise<string> {
  if (!mediaUrl) return "";
  if (/^https?:\/\//i.test(mediaUrl) || mediaUrl.startsWith("blob:") || mediaUrl.startsWith("data:")) {
    return mediaUrl;
  }
  const { data, error } = await supabase.storage
    .from(ANNOUNCEMENTS_BUCKET)
    .createSignedUrl(mediaUrl, 60 * 60);
  if (error || !data?.signedUrl) {
    console.error("[announcementMedia] Failed to sign URL", error);
    return "";
  }
  return data.signedUrl;
}

/** Uploads a file to the announcements bucket and returns its storage path. */
export async function uploadAnnouncementMedia(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(ANNOUNCEMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function deleteAnnouncementMedia(mediaUrl: string) {
  if (!mediaUrl || /^https?:\/\//i.test(mediaUrl)) return;
  await supabase.storage.from(ANNOUNCEMENTS_BUCKET).remove([mediaUrl]);
}

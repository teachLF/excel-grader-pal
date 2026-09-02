import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAnnouncements, type Announcement } from "@/hooks/useAnnouncements";
import { uploadAnnouncementMedia, deleteAnnouncementMedia, resolveMediaUrl } from "@/lib/announcementMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, Check, X, Search, RefreshCw, Plus, Trash2, FileVideo, Image as ImageIcon, Upload, Crown } from "lucide-react";

type Profile = {
  id: string;
  email: string | null;
  approved: boolean;
  is_plus: boolean;
  plus_requested: boolean;
  created_at: string;
};

function AnnouncementMedia({ announcement }: { announcement: Announcement }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    void resolveMediaUrl(announcement.media_url).then((u) => active && setSrc(u));
    return () => {
      active = false;
    };
  }, [announcement.media_url]);
  if (!src) return <div className="w-full h-[120px] grid place-items-center text-xs text-muted-foreground">...</div>;
  return announcement.media_type === "video" ? (
    <video src={src} className="w-full aspect-video object-cover bg-black" controls style={{ maxHeight: "200px" }} />
  ) : (
    <img
      src={src}
      alt={announcement.title}
      className="w-full aspect-video object-cover"
      style={{ maxHeight: "200px" }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

export function AdminPanel() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "plus_requests">("all");

  // Announcements
  const { announcements, add: addAnnouncement, update: updateAnnouncement, remove: removeAnnouncement } = useAnnouncements();
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    description: "",
    media_type: "image" as "image" | "video",
    media_url: "",
    skip_delay_seconds: 5,
    is_active: true,
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // access control handled by <AdminGuard>


  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, approved, is_plus, plus_requested, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[AdminPanel] Profiles query failed", error);
        toast.error("خطأ في جلب بيانات المستخدمين");
        setProfiles([]);
      } else {
        setProfiles(data ?? []);
      }
    } catch (err) {
      console.error("[AdminPanel] Profiles query exception", err);
      toast.error("حدث خطأ عند جلب البيانات");
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [isAdmin]);

  const setApproved = async (id: string, approved: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ approved })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approved ? "تمت الموافقة" : "تم الإلغاء");
    setProfiles((p) => p.map((x) => (x.id === id ? { ...x, approved } : x)));
  };

  const setPlus = async (id: string, is_plus: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_plus, plus_requested: false })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(is_plus ? "تم تفعيل Plus" : "تم إلغاء Plus");
    setProfiles((p) => p.map((x) => (x.id === id ? { ...x, is_plus, plus_requested: false } : x)));
  };

  const handleMediaFile = (file: File | null) => {
    setMediaFile(file);
    if (!file) return;
    const type = file.type.startsWith("video/") ? "video" : "image";
    setNewAnnouncement((a) => ({ ...a, media_type: type }));
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title || !mediaFile) {
      toast.error("يجب ملء العنوان واختيار ملف الصورة أو الفيديو");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadAnnouncementMedia(mediaFile);
      const result = await addAnnouncement({
        ...newAnnouncement,
        media_url: path,
        is_active: true,
      });
      if (result) {
        setNewAnnouncement({
          title: "",
          description: "",
          media_type: "image",
          media_url: "",
          skip_delay_seconds: 5,
          is_active: true,
        });
        setMediaFile(null);
        if (mediaInputRef.current) mediaInputRef.current.value = "";
        setShowAddAnnouncement(false);
      }
    } catch (err) {
      console.error("[AdminPanel] Upload failed", err);
      toast.error(err instanceof Error ? err.message : "فشل رفع الملف");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAnnouncement = async (a: Announcement) => {
    if (!confirm("حذف الإعلان؟")) return;
    const ok = await removeAnnouncement(a.id);
    if (ok !== false) await deleteAnnouncementMedia(a.media_url);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 86400000 : null;
    return profiles.filter((p) => {
      if (statusFilter === "pending" && p.approved) return false;
      if (statusFilter === "approved" && !p.approved) return false;
      if (statusFilter === "plus_requests" && !p.plus_requested) return false;
      if (q && !(p.email ?? "").toLowerCase().includes(q)) return false;
      const t = new Date(p.created_at).getTime();
      if (from && t < from) return false;
      if (to && t >= to) return false;
      return true;
    });
  }, [profiles, query, fromDate, toDate, statusFilter]);

  if (!isAdmin) {
    return <div className="min-h-screen flex items-center justify-center">...</div>;
  }


  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">لوحة المسؤول</h1>
            <p className="text-xs text-muted-foreground">إدارة الطلبات والإعلانات</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowRight className="h-4 w-4 ml-1" /> رجوع
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="users" className="w-full space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">المستخدمون</TabsTrigger>
            <TabsTrigger value="announcements">الإعلانات</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالبريد الإلكتروني..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">من تاريخ</label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">إلى تاريخ</label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">الحالة</label>
                  <div className="flex gap-1 mt-1">
                    {(["pending", "approved", "plus_requests", "all"] as const).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant={statusFilter === s ? "default" : "outline"}
                        onClick={() => setStatusFilter(s)}
                        className="flex-1"
                      >
                        {s === "pending" ? "قيد الانتظار" : s === "approved" ? "موافق عليهم" : s === "plus_requests" ? "طلبات Plus" : "الكل"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              {(query || fromDate || toDate || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setFromDate("");
                    setToDate("");
                    setStatusFilter("all");
                  }}
                >
                  مسح التصفية
                </Button>
              )}
            </Card>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {loading ? "جاري التحميل..." : `${filtered.length} من ${profiles.length} مستخدم`}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`ml-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                تحديث الطلبات
              </Button>
            </div>

            {filtered.length === 0 && !loading ? (
              <Card className="p-8 text-center text-muted-foreground">
                لا توجد نتائج
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((p) => (
                  <Card key={p.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate" dir="ltr">
                        {p.email ?? "(بدون بريد)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("ar")}
                        {" · "}
                        <span className={p.approved ? "text-green-600" : "text-amber-600"}>
                          {p.approved ? "موافق عليه" : "قيد الانتظار"}
                        </span>
                        {p.is_plus && (
                          <>
                            {" · "}
                            <span className="text-amber-500 font-semibold inline-flex items-center gap-0.5">
                              <Crown className="h-3 w-3" /> Plus
                            </span>
                          </>
                        )}
                        {!p.is_plus && p.plus_requested && (
                          <>
                            {" · "}
                            <span className="text-primary font-semibold">يطلب Plus</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                      {p.is_plus ? (
                        <Button size="sm" variant="outline" onClick={() => setPlus(p.id, false)} disabled={p.id === user?.id}>
                          <Crown className="h-4 w-4 ml-1" /> إلغاء Plus
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={p.plus_requested ? "default" : "outline"}
                          onClick={() => setPlus(p.id, true)}
                          className={p.plus_requested ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                        >
                          <Crown className="h-4 w-4 ml-1" /> {p.plus_requested ? "قبول Plus" : "منح Plus"}
                        </Button>
                      )}
                      {p.approved ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setApproved(p.id, false)}
                          disabled={p.id === user?.id}
                        >
                          <X className="h-4 w-4 ml-1" /> إلغاء
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setApproved(p.id, true)}>
                          <Check className="h-4 w-4 ml-1" /> موافقة
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                إجمالي الإعلانات: {announcements.length}
              </p>
              <Button
                size="sm"
                onClick={() => setShowAddAnnouncement(!showAddAnnouncement)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                إعلان جديد
              </Button>
            </div>

            {/* Add Announcement Form */}
            {showAddAnnouncement && (
              <Card className="p-4 space-y-4 bg-accent/50">
                <h3 className="font-semibold">إضافة إعلان جديد</h3>
                
                <div>
                  <label className="text-sm font-medium">العنوان</label>
                  <Input
                    placeholder="عنوان الإعلان"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">الوصف</label>
                  <Textarea
                    placeholder="وصف الإعلان"
                    value={newAnnouncement.description}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, description: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">نوع الوسائط</label>
                    <Select
                      value={newAnnouncement.media_type}
                      onValueChange={(value: "video" | "image") =>
                        setNewAnnouncement({ ...newAnnouncement, media_type: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            صورة
                          </div>
                        </SelectItem>
                        <SelectItem value="video">
                          <div className="flex items-center gap-2">
                            <FileVideo className="w-4 h-4" />
                            فيديو
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">ثواني التخطي</label>
                    <Input
                      type="number"
                      min="0"
                      max="60"
                      value={newAnnouncement.skip_delay_seconds}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, skip_delay_seconds: parseInt(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">ملف الصورة أو الفيديو</label>
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => handleMediaFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Button type="button" variant="secondary" onClick={() => mediaInputRef.current?.click()} className="gap-2">
                      <Upload className="w-4 h-4" /> اختر من الجهاز
                    </Button>
                    {mediaFile && (
                      <span className="text-xs text-muted-foreground truncate max-w-[240px]" dir="ltr">
                        {mediaFile.name} · {(mediaFile.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                  {mediaFile && (
                    <div className="mt-2 bg-muted rounded overflow-hidden">
                      {mediaFile.type.startsWith("video/") ? (
                        <video src={URL.createObjectURL(mediaFile)} className="w-full max-h-[200px] bg-black" controls />
                      ) : (
                        <img src={URL.createObjectURL(mediaFile)} alt="" className="w-full max-h-[200px] object-contain" />
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">الحد الأقصى لحجم الملف 100 MB.</p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddAnnouncement(false);
                      setMediaFile(null);
                      setNewAnnouncement({
                        title: "",
                        description: "",
                        media_type: "image",
                        media_url: "",
                        skip_delay_seconds: 5,
                        is_active: true,
                      });
                    }}
                  >
                    إلغاء
                  </Button>
                  <Button onClick={handleAddAnnouncement} className="gap-2" disabled={uploading}>
                    <Plus className="w-4 h-4" />
                    {uploading ? "جاري الرفع..." : "إضافة الإعلان"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Announcements List */}
            {announcements.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                لا توجد إعلانات حتى الآن
              </Card>
            ) : (
              <div className="space-y-2">
                {announcements.map((announcement) => (
                  <Card key={announcement.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold">{announcement.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{announcement.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {announcement.media_type === "video" ? (
                            <span className="inline-flex items-center gap-1">
                              <FileVideo className="w-3 h-3" /> فيديو
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> صورة
                            </span>
                          )}
                          {" · "}
                          تخطي بعد {announcement.skip_delay_seconds} ثانية
                          {" · "}
                          <span className={announcement.is_active ? "text-green-600" : "text-gray-600"}>
                            {announcement.is_active ? "نشط" : "غير نشط"}
                          </span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveAnnouncement(announcement)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Media Preview */}
                    <div className="bg-muted rounded overflow-hidden">
                      <AnnouncementMedia announcement={announcement} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
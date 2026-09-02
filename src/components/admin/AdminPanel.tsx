import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAnnouncements, type Announcement } from "@/hooks/useAnnouncements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, Check, X, Search, RefreshCw, Plus, Trash2, FileVideo, Image as ImageIcon } from "lucide-react";

type Profile = {
  id: string;
  email: string | null;
  approved: boolean;
  created_at: string;
};

export function AdminPanel() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");

  // Announcements
  const { announcements, add: addAnnouncement, update: updateAnnouncement, remove: removeAnnouncement } = useAnnouncements();
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    description: "",
    media_type: "image" as const,
    media_url: "",
    skip_delay_seconds: 5,
    is_active: true,
  });

  // access control handled by <AdminGuard>


  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, approved, created_at")
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

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.media_url) {
      toast.error("يجب ملء العنوان ورابط الوسائط");
      return;
    }
    
    const result = await addAnnouncement({
      ...newAnnouncement,
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
      setShowAddAnnouncement(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 86400000 : null;
    return profiles.filter((p) => {
      if (statusFilter === "pending" && p.approved) return false;
      if (statusFilter === "approved" && !p.approved) return false;
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
                    {(["pending", "approved", "all"] as const).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant={statusFilter === s ? "default" : "outline"}
                        onClick={() => setStatusFilter(s)}
                        className="flex-1"
                      >
                        {s === "pending" ? "قيد الانتظار" : s === "approved" ? "موافق عليهم" : "الكل"}
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
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
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
                  <label className="text-sm font-medium">رابط الوسائط</label>
                  <Input
                    type="url"
                    placeholder="https://example.com/image.jpg أو video.mp4"
                    value={newAnnouncement.media_url}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, media_url: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddAnnouncement(false);
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
                  <Button onClick={handleAddAnnouncement} className="gap-2">
                    <Plus className="w-4 h-4" />
                    إضافة الإعلان
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
                        onClick={() => removeAnnouncement(announcement.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Media Preview */}
                    <div className="bg-muted rounded overflow-hidden">
                      {announcement.media_type === "video" ? (
                        <video
                          src={announcement.media_url}
                          className="w-full aspect-video object-cover bg-black"
                          controls
                          style={{ maxHeight: "200px" }}
                        />
                      ) : (
                        <img
                          src={announcement.media_url}
                          alt={announcement.title}
                          className="w-full aspect-video object-cover"
                          style={{ maxHeight: "200px" }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
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
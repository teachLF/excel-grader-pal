import { useEffect, useState } from "react";
import { Announcement } from "@/hooks/useAnnouncements";
import { resolveMediaUrl } from "@/lib/announcementMedia";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Play } from "lucide-react";

interface AnnouncementDialogProps {
  announcement: Announcement | null;
  onClose: () => void;
}

export function AnnouncementDialog({ announcement, onClose }: AnnouncementDialogProps) {
  const [canSkip, setCanSkip] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    setSrc("");
    if (announcement) {
      void resolveMediaUrl(announcement.media_url).then((u) => active && setSrc(u));
    }
    return () => {
      active = false;
    };
  }, [announcement]);

  useEffect(() => {
    if (!announcement) {
      setCanSkip(false);
      setTimeLeft(0);
      return;
    }

    setCanSkip(false);
    setTimeLeft(announcement.skip_delay_seconds);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [announcement]);

  if (!announcement) return null;

  return (
    <Dialog open={!!announcement} onOpenChange={(open) => {
      if (!open && canSkip) {
        onClose();
      }
    }}>
      <DialogContent
        className="[&>button]:hidden max-w-none w-screen h-[100dvh] sm:max-w-none rounded-none border-0 p-0 translate-x-0 translate-y-0 top-0 left-0 bg-black text-white gap-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{announcement.title}</DialogTitle>
          <DialogDescription>{announcement.description}</DialogDescription>
        </DialogHeader>

        {/* الوسائط: تملأ الشاشة بالكامل بدون أي قص */}
        <div className="absolute inset-0 grid place-items-center bg-black">
          {!src ? (
            <div className="text-white/70 text-sm">جارٍ التحميل...</div>
          ) : announcement.media_type === "video" ? (
            <video
              src={src}
              className="max-h-full max-w-full h-full w-full object-contain"
              controls
              autoPlay
            />
          ) : (
            <img
              src={src}
              alt={announcement.title}
              className="max-h-full max-w-full h-full w-full object-contain"
            />
          )}
        </div>

        {/* النص */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4 pb-20 text-center">
          <h2 className="text-xl font-bold">{announcement.title}</h2>
          {announcement.description ? (
            <p className="mt-1 text-sm text-white/80">{announcement.description}</p>
          ) : null}
        </div>

        {/* زر التخطي */}
        <div className="absolute top-4 left-4 z-20">
          {canSkip ? (
            <Button onClick={onClose} variant="default" className="gap-2">
              <X className="w-4 h-4" />
              تخطي
            </Button>
          ) : (
            <Button disabled variant="secondary" className="gap-2">
              <Play className="w-4 h-4 animate-pulse" />
              تخطي بعد {timeLeft}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

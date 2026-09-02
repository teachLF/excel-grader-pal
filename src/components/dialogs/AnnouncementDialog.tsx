import { useEffect, useState } from "react";
import { Announcement } from "@/hooks/useAnnouncements";
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {announcement.title}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {announcement.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Media Section */}
          <div className="bg-muted rounded-lg overflow-hidden">
            {announcement.media_type === "video" ? (
              <video
                src={announcement.media_url}
                className="w-full aspect-video object-cover bg-black"
                controls
                autoPlay
              />
            ) : (
              <img
                src={announcement.media_url}
                alt={announcement.title}
                className="w-full aspect-video object-cover"
              />
            )}
          </div>

          {/* Skip Button */}
          <div className="flex items-center justify-between">
            <div></div>
            {canSkip ? (
              <Button
                onClick={onClose}
                variant="default"
                className="gap-2"
              >
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

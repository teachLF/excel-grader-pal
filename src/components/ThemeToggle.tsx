import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "teachlf-theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme: Theme = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  useEffect(() => {
    const findLeaderboardLink = () => {
      if (portalHost?.isConnected) return;

      const leaderboardLink = document.querySelector<HTMLAnchorElement>('a[href="/leaderboard"]');
      if (!leaderboardLink?.parentElement) {
        setPortalHost(null);
        return;
      }

      const existingHost = leaderboardLink.parentElement.querySelector<HTMLElement>(
        ":scope > [data-theme-toggle-host]",
      );
      if (existingHost) {
        setPortalHost(existingHost);
        return;
      }

      const host = document.createElement("span");
      host.dataset.themeToggleHost = "true";
      host.className = "inline-flex shrink-0";
      leaderboardLink.insertAdjacentElement("afterend", host);
      setPortalHost(host);
    };

    findLeaderboardLink();
    const observer = new MutationObserver(findLeaderboardLink);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [portalHost]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const button = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={
        portalHost
          ? "h-8 w-8 border-border bg-background text-foreground shadow-sm hover:bg-accent"
          : "fixed left-4 top-4 z-50 border-border bg-background text-foreground shadow-lg hover:bg-accent"
      }
      aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}
      title={theme === "light" ? "الوضع الداكن" : "الوضع الفاتح"}
    >
      {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );

  return portalHost ? createPortal(button, portalHost) : button;
}

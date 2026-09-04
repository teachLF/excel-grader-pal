import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import "../styles.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";

const themeInitializationScript = `
(function () {
  try {
    var theme = localStorage.getItem("teachlf-theme") === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "teachLF" },
      { name: "description", content: "Student Status Tracker allows educators to manage student attendance and status efficiently." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "teachLF" },
      { property: "og:description", content: "Student Status Tracker allows educators to manage student attendance and status efficiently." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "teachLF" },
      { name: "twitter:description", content: "Student Status Tracker allows educators to manage student attendance and status efficiently." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6f5cbaf0-ac6f-4be6-9132-74dfa90b8c41/id-preview-3a3dda0f--23984e3f-bc27-48de-8156-373e378e4141.lovable.app-1779643555587.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6f5cbaf0-ac6f-4be6-9132-74dfa90b8c41/id-preview-3a3dda0f--23984e3f-bc27-48de-8156-373e378e4141.lovable.app-1779643555587.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
        <style>{`
          html:not(.dark) {
            --background: oklch(1 0 0);
            --sidebar: oklch(1 0 0);
          }

          header.bg-brand-gradient {
            background-color: var(--card) !important;
            background-image: none !important;
            color: var(--foreground) !important;
            border-bottom: 1px solid var(--border);
            box-shadow: 0 1px 3px color-mix(in oklab, var(--foreground) 7%, transparent);
          }

          header.bg-brand-gradient a,
          header.bg-brand-gradient button,
          header.bg-brand-gradient p {
            color: var(--foreground) !important;
          }

          header.bg-brand-gradient p {
            opacity: 0.65;
          }

          header.bg-brand-gradient a,
          header.bg-brand-gradient button {
            background-color: var(--secondary) !important;
            border-color: var(--border) !important;
          }

          header.bg-brand-gradient a:hover,
          header.bg-brand-gradient button:hover {
            background-color: var(--accent) !important;
          }
        `}</style>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <ThemeToggle />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/pages/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "متابعة الطلاب — إدارة الفصول" },
      { name: "description", content: "نظام عربي لإدارة الفصول ومتابعة حضور الطلاب وسلوكهم." },
      { property: "og:title", content: "متابعة الطلاب — إدارة الفصول" },
      { property: "og:description", content: "نظام عربي لإدارة الفصول ومتابعة حضور الطلاب وسلوكهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Dashboard />;
}

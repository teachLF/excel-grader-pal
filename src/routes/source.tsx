import { createFileRoute } from "@tanstack/react-router";
import { SourceCodeViewer } from "@/components/pages/SourceCodeViewer";

export const Route = createFileRoute("/source")({
  head: () => ({
    meta: [
      { title: "أكواد الموقع | teachLF" },
      { name: "description", content: "عرض أكواد المشروع للمسؤولين فقط." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "أكواد الموقع | teachLF" },
      { property: "og:description", content: "عرض أكواد المشروع للمسؤولين فقط." },
    ],
  }),
  component: SourceCodeViewer,
});

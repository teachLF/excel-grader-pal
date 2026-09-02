import { createFileRoute } from "@tanstack/react-router";
import { MyStatsPage } from "@/components/pages/MyStatsPage";

export const Route = createFileRoute("/my-stats")({
  head: () => ({
    meta: [
      { title: "صفحتي — متابعة الطالبات" },
      {
        name: "description",
        content: "صفحة الطالبة الخاصة: نقاطها وحضورها وسلوكها فقط دون رؤية بيانات غيرها.",
      },
      { property: "og:title", content: "صفحتي — متابعة الطالبات" },
      {
        property: "og:description",
        content: "عرض خاص لكل طالبة: النقاط والحضور والسلوك بخصوصية تامة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyStatsPage,
});

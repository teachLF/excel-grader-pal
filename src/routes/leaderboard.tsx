import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardPage } from "@/components/pages/LeaderboardPage";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "لوحة الصدارة — متابعة الطالبات" },
      {
        name: "description",
        content: "ترتيب الطالبات حسب مجموع النقاط فقط، بأسماء مختصرة حفاظًا على الخصوصية.",
      },
      { property: "og:title", content: "لوحة الصدارة — متابعة الطالبات" },
      {
        property: "og:description",
        content: "ترتيب الطالبات حسب مجموع النقاط فقط مع الحفاظ على الخصوصية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

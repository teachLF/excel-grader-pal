import { createFileRoute } from "@tanstack/react-router";
import { ClassPage } from "@/components/pages/ClassPage";

export const Route = createFileRoute("/class/$id")({
  component: ClassRoute,
});

function ClassRoute() {
  const { id } = Route.useParams();
  return <ClassPage classId={id} />;
}
import { ProjectMemoriesView } from "@/components/projects/ProjectMemoriesView";

export default async function ProjectMemoriesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="container mx-auto p-6">
      <ProjectMemoriesView projectId={projectId} />
    </div>
  );
}

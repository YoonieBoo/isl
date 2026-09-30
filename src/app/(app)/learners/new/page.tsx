import { PageHeader, Card } from "@/components/ui";
import { LearnerForm } from "@/app/(app)/learners/learner-form";
import { createLearner } from "@/app/actions/learners";

export default async function NewLearnerPage({
  searchParams,
}: PageProps<"/learners/new">) {
  const { environment } = await searchParams;
  const environmentId = typeof environment === "string" ? environment : undefined;
  const cancelHref = environmentId
    ? `/learning-environments/${environmentId}`
    : "/learners";

  return (
    <div>
      <PageHeader title="New Learner" />
      <Card className="mt-6 max-w-lg">
        <LearnerForm
          action={createLearner}
          submitLabel="Create learner"
          onCancelHref={cancelHref}
          environmentId={environmentId}
        />
      </Card>
    </div>
  );
}

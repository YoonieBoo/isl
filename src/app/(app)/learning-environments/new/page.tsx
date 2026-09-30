import { PageHeader, Card } from "@/components/ui";
import { EnvironmentForm } from "@/app/(app)/learning-environments/environment-form";
import { createLearningEnvironment } from "@/app/actions/learning-environments";

export default function NewLearningEnvironmentPage() {
  return (
    <div>
      <PageHeader
        title="New Learning Environment"
        description="Define the course or workshop context that datasets will be scoped to."
      />
      <Card className="mt-6 max-w-2xl">
        <EnvironmentForm
          action={createLearningEnvironment}
          submitLabel="Create environment"
          onCancelHref="/learning-environments"
        />
      </Card>
    </div>
  );
}

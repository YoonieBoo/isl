import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { EnvironmentForm } from "@/app/(app)/learning-environments/environment-form";
import { updateLearningEnvironment } from "@/app/actions/learning-environments";

export default async function EditLearningEnvironmentPage({
  params,
}: PageProps<"/learning-environments/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: env, error } = await supabase
    .from("learning_environments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !env) notFound();

  const boundAction = updateLearningEnvironment.bind(null, id);

  return (
    <div>
      <PageHeader title={`Edit ${env.name}`} />
      <Card className="mt-6 max-w-2xl">
        <EnvironmentForm
          action={boundAction}
          submitLabel="Save changes"
          onCancelHref={`/learning-environments/${id}`}
          defaultValues={{
            name: env.name,
            organisationName: env.organisation_name,
            environmentType: env.environment_type,
            courseOrWorkshop: env.course_or_workshop,
            description: env.description,
            learningObjectives: env.learning_objectives,
          }}
        />
      </Card>
    </div>
  );
}

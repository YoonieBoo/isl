import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { LearnerForm } from "@/app/(app)/learners/learner-form";
import { updateLearner } from "@/app/actions/learners";

export default async function EditLearnerPage({
  params,
}: PageProps<"/learners/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: learner, error } = await supabase
    .from("learners")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !learner) notFound();

  const boundAction = updateLearner.bind(null, id);

  return (
    <div>
      <PageHeader title={`Edit ${learner.display_name}`} />
      <Card className="mt-6 max-w-lg">
        <LearnerForm
          action={boundAction}
          submitLabel="Save changes"
          onCancelHref={`/learners/${id}`}
          defaultValues={{
            displayName: learner.display_name,
            externalReference: learner.external_reference,
            email: learner.email,
          }}
        />
      </Card>
    </div>
  );
}

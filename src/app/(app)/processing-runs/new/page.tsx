import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { SetupForm } from "@/app/(app)/processing-runs/new/setup-form";

export default async function NewProcessingRunPage({
  searchParams,
}: PageProps<"/processing-runs/new">) {
  const params = await searchParams;
  const environmentId = typeof params.environment === "string" ? params.environment : undefined;
  const datasetId = typeof params.dataset === "string" ? params.dataset : undefined;
  const learnerId = typeof params.learner === "string" ? params.learner : undefined;

  const supabase = await createClient();
  const [{ data: environments }, { data: datasets }, { data: learner }] = await Promise.all([
    supabase.from("learning_environments").select("id, name").eq("status", "active").order("name"),
    supabase
      .from("datasets")
      .select("id, name, environment_id")
      .in("validation_status", ["valid", "valid_with_warnings"])
      .order("name"),
    learnerId
      ? supabase.from("learners").select("display_name").eq("id", learnerId).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <PageHeader
        title="New Processing Run"
        description="Define processing context, then confirm the configuration before it runs."
      />
      <Card className="mt-6 max-w-2xl">
        <SetupForm
          environments={environments ?? []}
          datasets={datasets ?? []}
          defaultEnvironmentId={environmentId}
          defaultDatasetId={datasetId}
          learnerId={learnerId}
          learnerName={learner?.display_name}
        />
      </Card>
    </div>
  );
}

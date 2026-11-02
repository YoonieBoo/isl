import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { UploadForm } from "@/app/(app)/datasets/new/upload-form";
import Link from "next/link";
import { PrimaryButton } from "@/components/ui";

export default async function NewDatasetPage({
  searchParams,
}: PageProps<"/datasets/new">) {
  const { environment, returnTo, workshop } = await searchParams;
  const requestedEnvironmentId = typeof environment === "string" ? environment : undefined;
  const returnToPath = typeof returnTo === "string" ? returnTo : undefined;

  const supabase = await createClient();
  const { data: environments } = await supabase
    .from("learning_environments")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  const { data: workshops } = await supabase
    .from("workshops")
    .select("id, environment_id, week_number, title")
    .in("environment_id", (environments ?? []).map((e) => e.id))
    .order("week_number");

  // A select's defaultValue that doesn't match any option silently falls
  // back to whatever is first in the list — so an invalid/stale environment
  // id in the URL must NOT be passed through, or the form would look
  // pre-filled while actually pointing at the wrong class.
  const environmentId = environments?.some((e) => e.id === requestedEnvironmentId)
    ? requestedEnvironmentId
    : undefined;

  return (
    <div>
      <PageHeader title="Upload Datasets" description="Drop in as many files as you need — each becomes its own dataset." />
      <Card className="mt-6 max-w-xl">
        {environments && environments.length > 0 ? (
          <UploadForm
            environments={environments}
            workshops={workshops ?? []}
            defaultEnvironmentId={environmentId}
            defaultWorkshopId={
              (workshops ?? []).some((w) => w.id === workshop && w.environment_id === environmentId)
                ? (workshop as string)
                : undefined
            }
            returnTo={returnToPath}
          />
        ) : (
          <EmptyState
            title="No learning environments yet"
            description="Create a learning environment before uploading a dataset."
            action={
              <Link href="/learning-environments/new">
                <PrimaryButton>New environment</PrimaryButton>
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { DatabaseIcon } from "@/components/icons";
import { AutoRefresh } from "@/components/auto-refresh";

const STATUS_TONE = {
  pending: "neutral",
  valid: "success",
  valid_with_warnings: "warning",
  invalid: "danger",
} as const;

export default async function DatasetsPage({
  searchParams,
}: PageProps<"/datasets">) {
  const { environment, uploaded, failed } = await searchParams;
  const environmentId = typeof environment === "string" ? environment : undefined;
  const uploadedCount = typeof uploaded === "string" ? Number(uploaded) : undefined;
  const failedCount = typeof failed === "string" ? Number(failed) : undefined;

  const supabase = await createClient();

  let query = supabase
    .from("datasets")
    .select("id, name, record_count, validation_status, created_at, learning_environments(name)")
    .order("created_at", { ascending: false });

  if (environmentId) query = query.eq("environment_id", environmentId);

  const { data: datasets, error } = await query;

  const newHref = environmentId ? `/datasets/new?environment=${environmentId}` : "/datasets/new";

  const hasPending = datasets?.some((d) => d.validation_status === "pending") ?? false;

  return (
    <div>
      <AutoRefresh active={hasPending} />
      <PageHeader
        title="Datasets"
        icon={DatabaseIcon}
        iconClassName="bg-emerald-50 text-emerald-600"
        description="Uploaded learner datasets, their validation status, and record counts."
        action={
          <Link href={newHref}>
            <PrimaryButton>Upload dataset</PrimaryButton>
          </Link>
        }
      />

      <div className="mt-6">
        {uploadedCount !== undefined && uploadedCount > 0 && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              failedCount ? "border-amber-200 bg-amber-50 text-warning" : "border-green-200 bg-green-50 text-success"
            }`}
          >
            Uploaded {uploadedCount} dataset{uploadedCount === 1 ? "" : "s"}
            {failedCount ? ` — ${failedCount} file${failedCount === 1 ? "" : "s"} failed to upload.` : "."} Each one
            below is ready to validate.
          </div>
        )}
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!error && datasets && datasets.length === 0 && (
          <EmptyState
            title="No datasets yet"
            description="Upload a CSV or XLSX file of learner data to get started."
            action={
              <Link href={newHref}>
                <PrimaryButton>Upload dataset</PrimaryButton>
              </Link>
            }
          />
        )}

        {datasets && datasets.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Environment</th>
                  <th className="px-5 py-3">Records</th>
                  <th className="px-5 py-3">Validation</th>
                  <th className="px-5 py-3">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr key={ds.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/datasets/${ds.id}`} className="font-medium text-isl-blue hover:underline">
                        {ds.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {ds.learning_environments?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">{ds.record_count}</td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[ds.validation_status]}>
                        {ds.validation_status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {new Date(ds.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

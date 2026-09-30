import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ValidateForm } from "@/app/(app)/datasets/[id]/validate-form";
import { AutoRefresh } from "@/components/auto-refresh";

const STATUS_TONE = {
  pending: "neutral",
  valid: "success",
  valid_with_warnings: "warning",
  invalid: "danger",
} as const;

type ValidationSummary = {
  columns?: string[];
  idColumn?: string;
  nameColumn?: string | null;
  suggestedIdColumn?: string;
  suggestedNameColumn?: string;
  totalRecords?: number;
  missingIds?: number;
  duplicateIds?: number;
  emptyRecords?: number;
  newLearnersCreated?: number;
  matchedExistingLearners?: number;
};

export default async function DatasetDetailPage({
  params,
}: PageProps<"/datasets/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: dataset, error }, { data: records }] = await Promise.all([
    supabase
      .from("datasets")
      .select("*, learning_environments(id, name)")
      .eq("id", id)
      .single(),
    supabase
      .from("dataset_records")
      .select("id, source_record_id, source_data, validation_status, validation_notes, learner_id")
      .eq("dataset_id", id)
      .order("source_record_id")
      .limit(100),
  ]);

  if (error || !dataset) notFound();

  const summary = (dataset.validation_summary as ValidationSummary) ?? {};
  const columns = summary.columns ?? [];

  return (
    <div>
      <AutoRefresh active={dataset.validation_status === "pending"} />
      <PageHeader
        title={dataset.name}
        description={`${dataset.learning_environments?.name ?? "Unknown environment"} · ${dataset.original_file_name}`}
      />

      <div className="mt-2 flex items-center gap-2">
        <Badge tone={STATUS_TONE[dataset.validation_status]}>
          {dataset.validation_status.replace(/_/g, " ")}
        </Badge>
        <span className="text-sm text-foreground-muted">
          {dataset.record_count} record{dataset.record_count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-foreground">Map &amp; validate</h2>
          <p className="mt-1 text-xs text-foreground-muted">
            Detected columns: {columns.join(", ") || "none"}
          </p>
          <div className="mt-4">
            {columns.length > 0 ? (
              <ValidateForm
                datasetId={dataset.id}
                columns={columns}
                defaultIdColumn={summary.idColumn ?? summary.suggestedIdColumn}
                defaultNameColumn={summary.nameColumn ?? summary.suggestedNameColumn ?? undefined}
              />
            ) : (
              <p className="text-sm text-foreground-muted">
                No columns detected in this file.
              </p>
            )}
          </div>

          {summary.totalRecords !== undefined && (
            <dl className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Matched existing learners</dt>
                <dd className="font-medium text-foreground">{summary.matchedExistingLearners}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">New learners created</dt>
                <dd className="font-medium text-foreground">{summary.newLearnersCreated}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Missing IDs</dt>
                <dd className="font-medium text-foreground">{summary.missingIds}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Duplicate submissions</dt>
                <dd className="font-medium text-foreground">{summary.duplicateIds}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Empty records</dt>
                <dd className="font-medium text-foreground">{summary.emptyRecords}</dd>
              </div>
            </dl>
          )}
        </Card>

        <Card className="overflow-x-auto p-0 lg:col-span-2">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Records preview {records && records.length >= 100 && "(first 100)"}
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-5 py-2">Row</th>
                <th className="px-5 py-2">Learner</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(records ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2 text-foreground-muted">{r.source_record_id}</td>
                  <td className="px-5 py-2">
                    {r.learner_id ? (
                      <Link href={`/learners/${r.learner_id}`} className="text-isl-blue hover:underline">
                        View learner
                      </Link>
                    ) : (
                      <span className="text-foreground-muted">Unmapped</span>
                    )}
                  </td>
                  <td className="px-5 py-2">
                    <Badge tone={STATUS_TONE[r.validation_status]}>
                      {r.validation_status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-5 py-2 text-foreground-muted">{r.validation_notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {dataset.validation_status !== "invalid" && dataset.validation_status !== "pending" && (
        <div className="mt-6">
          <Link
            href={`/processing-runs/new?environment=${dataset.environment_id}&dataset=${dataset.id}`}
            className="text-sm font-medium text-isl-blue hover:underline"
          >
            Continue to processing setup →
          </Link>
        </div>
      )}
    </div>
  );
}

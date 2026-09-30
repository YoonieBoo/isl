import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader, PrimaryButton } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmButton } from "@/app/(app)/processing-runs/[id]/confirm-button";
import { ExecuteButton } from "@/app/(app)/processing-runs/[id]/execute-button";
import type { ProcessingContext } from "@/app/actions/processing-runs";
import { aiSourceLabel } from "@/lib/processing/ai-source-labels";
import { ArrowRightIcon } from "@/components/icons";

export const maxDuration = 300;

type Progress = {
  processed: number;
  total: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  skippedCount?: number;
};

const STATUS_TONE = {
  draft: "neutral",
  queued: "blue",
  running: "blue",
  completed: "success",
  completed_with_warning: "warning",
  failed: "danger",
  cancelled: "neutral",
} as const;

const CONTEXT_LABELS: Record<keyof ProcessingContext, string> = {
  learningObjective: "Learning objective",
  activityContext: "Course / activity context",
  learnerPopulation: "Learner population",
  activityType: "Activity type",
  interpretationFocus: "Interpretation focus",
  signalCategories: "Signal categories",
  taxonomyGuidance: "Taxonomy / interpretation guidance",
  processingNotes: "Processing notes",
  evidenceFields: "Fields to use as evidence",
};

export default async function ProcessingRunDetailPage({
  params,
}: PageProps<"/processing-runs/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run, error } = await supabase
    .from("processing_runs")
    .select("*, learning_environments(name), datasets(name), learners(display_name)")
    .eq("id", id)
    .single();

  if (error || !run) notFound();

  const context = run.processing_context as ProcessingContext;
  const progress = (run.processing_configuration as { progress?: Progress })?.progress;
  const isActive = run.status === "running";

  return (
    <div>
      <AutoRefresh active={run.status === "queued" || isActive} />
      <PageHeader
        title="Processing Run"
        description={
          <>
            <span className="block">{run.learning_environments?.name ?? "Run"}</span>
            <span className="block">
              {run.learner_id ? `Learner: ${run.learners?.display_name ?? "—"}` : (run.datasets?.name ?? "")}
            </span>
            <span className="block">
              Adapter: {aiSourceLabel(run.ai_source)}
              {run.model_or_tool ? ` (${run.model_or_tool})` : ""}
            </span>
          </>
        }
      />

      <div className="mt-2">
        <Badge tone={STATUS_TONE[run.status]}>{run.status.replace(/_/g, " ")}</Badge>
      </div>

      {progress && (
        <Card className="mt-4 max-w-2xl">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {progress.processed} / {progress.total} records processed
            </span>
            <span className="text-foreground-muted">
              {progress.successCount} success · {progress.warningCount} warning ·{" "}
              {progress.failedCount} failed
              {progress.skippedCount ? ` · ${progress.skippedCount} skipped (team-level evidence)` : ""}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-pale">
            <div
              className="h-full rounded-full bg-isl-blue transition-all"
              style={{
                width: `${progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
        </Card>
      )}

      <Card className="mt-6 max-w-2xl">
        <h2 className="text-base font-semibold text-foreground">Processing context</h2>
        <dl className="mt-5 space-y-6 text-sm">
          {(Object.keys(CONTEXT_LABELS) as (keyof ProcessingContext)[]).map((key) => (
            <div key={key}>
              <dt className="text-xs font-bold uppercase tracking-wide text-foreground-muted">
                {CONTEXT_LABELS[key]}
              </dt>
              <dd className="mt-1.5 leading-relaxed text-foreground">
                {context?.[key] || <span className="text-foreground-muted">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="mt-6">
        {run.status === "draft" && <ConfirmButton runId={run.id} />}
        {run.status === "queued" && <ExecuteButton runId={run.id} />}
        {isActive && (
          <p className="text-sm text-foreground-muted">Processing… this page updates automatically.</p>
        )}
        {(run.status === "completed" || run.status === "completed_with_warning") && (
          <div className="flex flex-wrap gap-3">
            <Link href={`/processing-runs/${run.id}/results`}>
              <PrimaryButton>
                View learner output
                <ArrowRightIcon className="h-4 w-4" />
              </PrimaryButton>
            </Link>
            <Link href={`/processing-runs/${run.id}/patterns`}>
              <PrimaryButton>
                View candidate patterns
                <ArrowRightIcon className="h-4 w-4" />
              </PrimaryButton>
            </Link>
          </div>
        )}
        {run.status === "failed" && (
          <p className="text-sm text-danger">
            Run failed — check the run&apos;s processing results for error details.
          </p>
        )}
      </div>
    </div>
  );
}

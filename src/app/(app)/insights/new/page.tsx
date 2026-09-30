import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge } from "@/components/ui";
import { InsightForm } from "@/app/(app)/insights/new/insight-form";
import { gatherReviewedSignals } from "@/lib/insight-evidence";

export default async function NewInsightPage({
  searchParams,
}: PageProps<"/insights/new">) {
  const { resultId } = await searchParams;
  if (typeof resultId !== "string") notFound();

  const supabase = await createClient();
  const source = await gatherReviewedSignals(supabase, resultId);
  if (!source) notFound();

  return (
    <div>
      <PageHeader
        title="New Learner Insight"
        description={`Draft an evidence-linked insight for ${source.learnerName}.`}
      />
      {source.evidenceItemCount > 1 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface-pale p-3 text-sm text-foreground-muted">
          <Badge tone="blue">{source.evidenceItemCount} reviewed evidence items</Badge>
          <span>
            This draft is pre-filled from every reviewed (agree/revise) result for this learner in this
            processing run, not just the one you started from.
          </span>
        </div>
      )}
      {source.correctedCount > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-surface-pale p-3 text-sm text-foreground-muted">
          <Badge tone="blue">{source.correctedCount} using reviewer&apos;s correction</Badge>
          <span>Pre-filled from the corrected reading recorded during review, not the original AI output.</span>
        </div>
      )}
      <Card className="mx-auto mt-6 max-w-2xl">
        <InsightForm
          learnerId={source.learnerId}
          learnerName={source.learnerName}
          environmentId={source.environmentId}
          processingRunId={source.processingRunId}
          signals={source.signals}
        />
      </Card>
    </div>
  );
}

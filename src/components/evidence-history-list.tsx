import Link from "next/link";
import { Badge } from "@/components/ui";
import { pickPrimaryField } from "@/lib/evidence-field";

export type EvidenceHistoryRecord = {
  id: string;
  source_data: unknown;
  created_at: string;
  datasets: { name: string | null; learning_environments: { name: string | null } | null } | null;
  processing_results: { id: string }[];
};

export function EvidenceHistoryList({
  records,
  dense = false,
}: {
  records: EvidenceHistoryRecord[];
  dense?: boolean;
}) {
  return (
    <div className={`divide-y divide-border ${dense ? "text-sm" : "text-base"}`}>
      {records.map((record) => {
        const sourceData = (record.source_data as Record<string, string>) ?? {};
        const primaryField = pickPrimaryField(sourceData);
        const questionPrompt = sourceData.question_prompt?.trim();
        const analyzed = record.processing_results.length > 0;
        return (
          <div
            key={record.id}
            className={`flex items-start justify-between gap-4 first:pt-0 last:pb-0 ${dense ? "py-2" : "py-4"}`}
          >
            <div className="min-w-0">
              <p className={`text-foreground ${dense ? "truncate" : "break-words"}`}>
                {primaryField ? sourceData[primaryField] : "—"}
              </p>
              <p className={`text-foreground-muted ${dense ? "mt-0.5 text-xs" : "mt-1.5 text-sm"} ${dense ? "truncate" : ""}`}>
                {questionPrompt
                  ? `Q: ${questionPrompt}`
                  : `${record.datasets?.learning_environments?.name ?? "—"} · ${record.datasets?.name ?? "—"}`}
                {" · "}
                {new Date(record.created_at).toLocaleDateString()}
              </p>
            </div>
            {analyzed ? (
              <Link href={`/reviews/${record.processing_results[0].id}`} className="shrink-0">
                <Badge tone="success">Analyzed</Badge>
              </Link>
            ) : (
              <span className="shrink-0">
                <Badge tone="neutral">Not yet analyzed</Badge>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

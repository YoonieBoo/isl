import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { FolderIcon } from "@/components/icons";

export default async function PortfoliosPage({
  searchParams,
}: PageProps<"/portfolios">) {
  const { learner } = await searchParams;
  const learnerId = typeof learner === "string" ? learner : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("portfolio_artifacts")
    .select("id, title, artifact_type, visibility, created_at, learners(id, display_name), external_url, file_reference")
    .order("created_at", { ascending: false });

  if (learnerId) query = query.eq("learner_id", learnerId);

  const { data: artifacts, error } = await query;

  const artifactsWithLinks = await Promise.all(
    (artifacts ?? []).map(async (a) => {
      if (a.external_url) return { ...a, viewUrl: a.external_url };
      if (a.file_reference) {
        const { data: signed } = await supabase.storage
          .from("portfolio")
          .createSignedUrl(a.file_reference, 3600);
        return { ...a, viewUrl: signed?.signedUrl ?? null };
      }
      return { ...a, viewUrl: null };
    }),
  );

  const newHref = learnerId ? `/portfolios/new?learner=${learnerId}` : "/portfolios/new";

  return (
    <div>
      <PageHeader
        title="Portfolios"
        icon={FolderIcon}
        iconClassName="bg-amber-50 text-amber-600"
        description="Evidence-backed learner artifacts."
        action={
          <Link href={newHref}>
            <PrimaryButton>Add artifact</PrimaryButton>
          </Link>
        }
      />

      <div className="mt-6">
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!error && artifactsWithLinks.length === 0 && (
          <EmptyState
            title="No portfolio artifacts yet"
            description="Add a project, assignment, reflection, or other evidence for a learner."
            action={
              <Link href={newHref}>
                <PrimaryButton>Add artifact</PrimaryButton>
              </Link>
            }
          />
        )}

        {artifactsWithLinks.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Learner</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Visibility</th>
                  <th className="px-5 py-3">Added</th>
                </tr>
              </thead>
              <tbody>
                {artifactsWithLinks.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      {a.viewUrl ? (
                        <a
                          href={a.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-isl-blue hover:underline"
                        >
                          {a.title}
                        </a>
                      ) : (
                        <span className="font-medium text-foreground">{a.title}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {a.learners?.id ? (
                        <Link href={`/learners/${a.learners.id}`} className="hover:underline">
                          {a.learners.display_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge>{a.artifact_type.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {a.visibility === "learner_visible" ? "Visible to learner" : "Internal"}
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {new Date(a.created_at).toLocaleDateString()}
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

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";
import { ArrowLeftIcon, BuildingIcon, SearchIcon, UserIcon } from "@/components/icons";

// PostgREST's .or() filter string treats "," and "()" as syntax, not
// literal characters — strip them so a search term can't break the filter
// (or, worse, be crafted to alter which condition it lands in).
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, "").trim();
}

export default async function LearnersPage({
  searchParams,
}: PageProps<"/learners">) {
  const { environment, q } = await searchParams;
  const environmentId = typeof environment === "string" ? environment : undefined;
  const searchTerm = typeof q === "string" ? q : "";

  const supabase = await createClient();

  let environmentName: string | null = null;
  let learnerIds: string[] | null = null;

  if (environmentId) {
    const [{ data: env }, { data: links }] = await Promise.all([
      supabase
        .from("learning_environments")
        .select("name")
        .eq("id", environmentId)
        .single(),
      supabase
        .from("learner_environments")
        .select("learner_id")
        .eq("environment_id", environmentId),
    ]);
    environmentName = env?.name ?? null;
    learnerIds = (links ?? []).map((l) => l.learner_id);
  }

  let query = supabase
    .from("learners")
    .select("id, display_name, external_reference, status, updated_at")
    .order("updated_at", { ascending: false });

  if (learnerIds) {
    query = query.in("id", learnerIds.length > 0 ? learnerIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const cleanedTerm = sanitizeSearchTerm(searchTerm);
  if (cleanedTerm) {
    query = query.or(
      `display_name.ilike.%${cleanedTerm}%,external_reference.ilike.%${cleanedTerm}%,email.ilike.%${cleanedTerm}%`,
    );
  }

  const cleanedTermSet = Boolean(cleanedTerm);
  const showGroupedByCourse = !environmentId && !cleanedTermSet;

  let courseGroups: { id: string; name: string; learnerCount: number }[] = [];
  if (showGroupedByCourse) {
    const { data: environments } = await supabase
      .from("learning_environments")
      .select("id, name")
      .order("name");
    const { data: allLinks } = await supabase.from("learner_environments").select("environment_id");
    const countByEnv = new Map<string, number>();
    for (const link of allLinks ?? []) {
      countByEnv.set(link.environment_id, (countByEnv.get(link.environment_id) ?? 0) + 1);
    }
    courseGroups = (environments ?? []).map((env) => ({
      id: env.id,
      name: env.name,
      learnerCount: countByEnv.get(env.id) ?? 0,
    }));
  }

  const { data: learners, error } = showGroupedByCourse
    ? { data: null, error: null }
    : await query;

  const newHref = environmentId ? `/learners/new?environment=${environmentId}` : "/learners/new";

  return (
    <div>
      {environmentId && (
        <Link
          href="/learners"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          All courses
        </Link>
      )}

      <PageHeader
        title="Learners"
        icon={UserIcon}
        description={
          environmentName
            ? `Learners in ${environmentName}.`
            : showGroupedByCourse
              ? "Grouped by learning environment — click one to see its learners."
              : "All learners across every learning environment."
        }
        action={
          <Link href={newHref}>
            <PrimaryButton>New learner</PrimaryButton>
          </Link>
        }
      />

      <form method="get" className="mt-6 flex max-w-sm items-center gap-2">
        {environmentId && <input type="hidden" name="environment" value={environmentId} />}
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <TextInput
            type="search"
            name="q"
            defaultValue={searchTerm}
            placeholder="Search by name, ID, or email"
            className="pl-9"
          />
        </div>
        <SecondaryButton type="submit">Search</SecondaryButton>
      </form>

      {showGroupedByCourse && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courseGroups.length === 0 && (
            <EmptyState
              title="No learning environments yet"
              description="Create a learning environment first, then upload a dataset to add learners."
            />
          )}
          {courseGroups.map((course) => (
            <Link key={course.id} href={`/learners?environment=${course.id}`}>
              <Card className="flex items-center gap-4 transition-colors hover:border-isl-blue">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-isl-blue-pale text-isl-blue">
                  <BuildingIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{course.name}</p>
                  <p className="text-sm text-foreground-muted">
                    {course.learnerCount} learner{course.learnerCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4">
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!showGroupedByCourse && !error && learners && learners.length === 0 && cleanedTerm && (
          <EmptyState
            title="No matching learners"
            description={`Nothing matches "${cleanedTerm}" — try a different name, ID, or email.`}
          />
        )}

        {!error && learners && learners.length === 0 && !cleanedTerm && (
          <EmptyState
            title="No learners yet"
            description="Add a learner manually, or upload a dataset and import learners from it."
            action={
              <Link href={newHref}>
                <PrimaryButton>New learner</PrimaryButton>
              </Link>
            }
          />
        )}

        {learners && learners.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Record updated</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((learner) => (
                  <tr key={learner.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/learners/${learner.id}`}
                        className="font-medium text-isl-blue hover:underline"
                      >
                        {learner.display_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {learner.external_reference || "—"}
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {new Date(learner.updated_at).toLocaleString()}
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

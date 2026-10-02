import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/icons";
import { LEVEL_STYLES, SkillLevelBadge, SkillLevelLegend } from "@/components/skill-level";
import { courseCode } from "@/lib/course-code";
import {
  LEVEL_LABEL,
  getSkillFramework,
  readSkillRatings,
  type SkillLevel,
  type SkillRatings,
} from "@/lib/skills/frameworks";

const COUNTED_LEVELS: SkillLevel[] = ["strong", "developing", "needs_support", "not_enough_evidence"];

// Class-wide skill grid: every learner in the course rated on the same fixed
// skills, so the class can be read at a glance ("most of the class needs
// support with X", "these learners are behind").
export default async function ClassSkillsPage({ params }: PageProps<"/learning-environments/[id]/cohort">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: env, error } = await supabase.from("learning_environments").select("id, name").eq("id", id).single();
  if (error || !env) notFound();

  const [{ data: memberships }, { data: insights }] = await Promise.all([
    supabase.from("learner_environments").select("learners(id, display_name, external_reference)").eq("environment_id", id),
    supabase
      .from("learner_insights")
      .select("learner_id, approved_output, updated_at")
      .eq("environment_id", id)
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
  ]);

  const framework = getSkillFramework(env.name);
  const code = courseCode(env.name);

  const ratingsByLearner = new Map<string, SkillRatings>();
  for (const insight of insights ?? []) {
    const ratings = readSkillRatings(insight.approved_output);
    if (ratings && !ratingsByLearner.has(insight.learner_id)) ratingsByLearner.set(insight.learner_id, ratings);
  }

  const learners = (memberships ?? [])
    .map((m) => m.learners)
    .filter((l): l is { id: string; display_name: string; external_reference: string | null } => Boolean(l))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const rated = learners.filter((l) => ratingsByLearner.has(l.id));
  const notRated = learners.filter((l) => !ratingsByLearner.has(l.id));

  const levelOf = (learnerId: string, skillKey: string): SkillLevel =>
    ratingsByLearner.get(learnerId)?.skills.find((s) => s.key === skillKey)?.level ?? "not_enough_evidence";

  const back = (
    <Link
      href={`/learning-environments/${env.id}`}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Back to {code}
    </Link>
  );

  if (!framework) {
    return (
      <div>
        {back}
        <div className="mt-4">
          <PageHeader title={`Class skills — ${code}`} />
        </div>
        <div className="mt-6">
          <EmptyState title="No skill list for this course yet" description="Skill ratings are only available for courses with a skill list set up." />
        </div>
      </div>
    );
  }

  return (
    <div>
      {back}
      <div className="mt-4">
        <PageHeader
          title={`Class skills — ${code}`}
          description="Every learner rated on the same skills from their own answers. Click a name to see the evidence behind each rating."
        />
      </div>

      <div className="mt-5">
        <SkillLevelLegend />
      </div>

      <Card className="mt-4">
        <h2 className="text-base font-semibold text-foreground">Whole class</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {rated.length} of {learners.length} learners rated.
        </p>
        <ul className="mt-4 space-y-3">
          {framework.skills.map((skill) => {
            const counts = Object.fromEntries(COUNTED_LEVELS.map((l) => [l, 0])) as Record<SkillLevel, number>;
            for (const l of rated) counts[levelOf(l.id, skill.key)]++;
            const total = rated.length || 1;
            return (
              <li key={skill.key} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
                <span className="text-sm font-medium text-foreground" title={skill.description}>
                  {skill.name}
                </span>
                <div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-pale">
                    {COUNTED_LEVELS.map((level) =>
                      counts[level] > 0 ? (
                        <div
                          key={level}
                          className={LEVEL_STYLES[level].dot}
                          style={{ width: `${(counts[level] / total) * 100}%` }}
                          title={`${LEVEL_LABEL[level]}: ${counts[level]}`}
                        />
                      ) : null,
                    )}
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {COUNTED_LEVELS.filter((level) => counts[level] > 0)
                      .map((level) => `${LEVEL_LABEL[level]} ${counts[level]}`)
                      .join(" · ") || "No ratings yet"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-4 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-foreground-muted">
                <th className="sticky left-0 z-10 min-w-[13rem] bg-surface px-5 py-3">Learner</th>
                {framework.skills.map((skill) => (
                  <th key={skill.key} className="min-w-[7.5rem] px-3 py-3 align-bottom" title={skill.description}>
                    {skill.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rated.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-surface px-5 py-2.5">
                    <Link href={`/profiles/${l.id}?environment=${env.id}`} className="font-medium text-isl-blue hover:underline">
                      {l.display_name}
                    </Link>
                    {l.external_reference && (
                      <span className="block text-xs text-foreground-muted">{l.external_reference}</span>
                    )}
                  </td>
                  {framework.skills.map((skill) => (
                    <td key={skill.key} className="px-3 py-2.5">
                      <SkillLevelBadge level={levelOf(l.id, skill.key)} compact />
                    </td>
                  ))}
                </tr>
              ))}
              {rated.length === 0 && (
                <tr>
                  <td colSpan={framework.skills.length + 1} className="px-5 py-6 text-center text-foreground-muted">
                    No learner in this course has been rated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {notRated.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-base font-semibold text-foreground">Not rated yet ({notRated.length})</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            No analyzed answers for these learners in {code} yet — open the learner and click Analyze.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            {notRated.map((l) => (
              <li key={l.id}>
                <Link href={`/learners/${l.id}`} className="text-isl-blue hover:underline">
                  {l.display_name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

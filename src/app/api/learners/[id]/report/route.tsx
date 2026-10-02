import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { LearnerReportDocument, type LearnerReportData } from "@/lib/pdf/learner-report";
import { courseCode } from "@/lib/course-code";
import { readCourseOverview } from "@/lib/skills/overview";
import { LEVEL_LABEL, bestEvidence, getSkillFramework, readSkillRatings, type SkillLevel, type SkillRatings } from "@/lib/skills/frameworks";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Set when downloaded from the profile's course dropdown: the PDF then covers that course only.
  const environmentId = new URL(request.url).searchParams.get("environment");
  const supabase = await createClient();

  let environmentsQuery = supabase
    .from("learner_environments")
    .select("environment_id, learning_environments(name)")
    .eq("learner_id", id);
  let insightsQuery = supabase
    .from("learner_insights")
    .select("environment_id, learning_preferences, approved_output, updated_at")
    .eq("learner_id", id)
    .eq("status", "approved")
    .order("updated_at", { ascending: false });
  if (environmentId) {
    environmentsQuery = environmentsQuery.eq("environment_id", environmentId);
    insightsQuery = insightsQuery.eq("environment_id", environmentId);
  }

  const [{ data: learner, error }, { data: environments }, { data: insights }, { data: learnerProfile }] = await Promise.all([
    supabase.from("learners").select("display_name, external_reference").eq("id", id).single(),
    environmentsQuery,
    insightsQuery,
    supabase.from("learner_profiles").select("summary").eq("learner_id", id).maybeSingle(),
  ]);

  if (error || !learner) {
    return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  }

  const ratingsByEnvironment = new Map<string, SkillRatings>();
  for (const insight of insights ?? []) {
    const ratings = readSkillRatings(insight.approved_output);
    if (ratings && !ratingsByEnvironment.has(insight.environment_id)) ratingsByEnvironment.set(insight.environment_id, ratings);
  }

  const courses = (environments ?? [])
    .filter((e) => e.learning_environments?.name)
    .map((e) => ({ id: e.environment_id, name: e.learning_environments!.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const multipleCourses = courses.length > 1;

  // Strengths / development focus come from the fixed per-course skill
  // ratings, in the same "label: quote" form the report renders.
  const bulletsFor = (levels: SkillLevel[]) => {
    const out: string[] = [];
    for (const level of levels) {
      for (const course of courses) {
        const framework = getSkillFramework(course.name);
        const ratings = ratingsByEnvironment.get(course.id);
        if (!framework || !ratings) continue;
        for (const skill of framework.skills) {
          const rating = ratings.skills.find((s) => s.key === skill.key);
          if (rating?.level !== level) continue;
          const tags = [levels.length > 1 ? LEVEL_LABEL[level] : null, multipleCourses ? courseCode(course.name) : null]
            .filter(Boolean)
            .join(", ");
          const label = tags ? `${skill.name} (${tags})` : skill.name;
          const quote = bestEvidence(rating)?.quote;
          out.push(quote ? `${label}: ${quote}` : label);
        }
      }
    }
    return out;
  };
  const strengths = bulletsFor(["strong"]);
  const developmentNeeds = bulletsFor(["needs_support", "developing"]);
  const learningPreferences = [...new Set((insights ?? []).flatMap((i) => i.learning_preferences))];

  // Same stored Overview the profile page shows: the course's own overview
  // for a single-course PDF, otherwise the learner's all-courses overview.
  const courseOverview = (insights ?? []).map((i) => readCourseOverview(i.approved_output)).find(Boolean) ?? null;
  const overview = environmentId ? courseOverview : (learnerProfile?.summary ?? courseOverview);

  const environmentNames = courses.map((c) => courseCode(c.name));
  const data: LearnerReportData = {
    learnerName: learner.display_name,
    externalReference: learner.external_reference,
    strengths,
    developmentNeeds,
    learningPreferences,
    environments: environmentNames,
    overview,
  };

  const buffer = await renderToBuffer(<LearnerReportDocument data={data} />);
  const fileStem = environmentId && environmentNames[0] ? `${learner.display_name} ${environmentNames[0]}` : learner.display_name;
  const fileName = `${fileStem.replace(/[^a-z0-9]+/gi, "-")}-insights.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { LearnerReportDocument, type LearnerReportData, type ReportCourse } from "@/lib/pdf/learner-report";
import { generateLearnerOverview } from "@/lib/pdf/learner-overview";
import { courseCode, shortFormName } from "@/lib/course-code";
import { getSkillFramework, readSkillRatings, type SkillRatings } from "@/lib/skills/frameworks";

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
    .select("environment_id, approved_output, updated_at")
    .eq("learner_id", id)
    .eq("status", "approved")
    .order("updated_at", { ascending: false });
  if (environmentId) {
    environmentsQuery = environmentsQuery.eq("environment_id", environmentId);
    insightsQuery = insightsQuery.eq("environment_id", environmentId);
  }

  const [{ data: learner, error }, { data: environments }, { data: insights }] = await Promise.all([
    supabase.from("learners").select("display_name, external_reference").eq("id", id).single(),
    environmentsQuery,
    insightsQuery,
  ]);

  if (error || !learner) {
    return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  }

  const ratingsByEnvironment = new Map<string, SkillRatings>();
  for (const insight of insights ?? []) {
    const ratings = readSkillRatings(insight.approved_output);
    if (ratings && !ratingsByEnvironment.has(insight.environment_id)) {
      ratingsByEnvironment.set(insight.environment_id, ratings);
    }
  }

  const courses: ReportCourse[] = (environments ?? [])
    .filter((e) => e.learning_environments?.name)
    .map((e) => {
      const name = e.learning_environments!.name;
      const framework = getSkillFramework(name);
      const ratings = ratingsByEnvironment.get(e.environment_id);
      if (!framework || !ratings) return { code: courseCode(name), overview: null, skills: null };
      const byKey = new Map(ratings.skills.map((s) => [s.key, s]));
      return {
        code: courseCode(name),
        overview: ratings.overview || null,
        skills: framework.skills.map((skill) => {
          const r = byKey.get(skill.key);
          return {
            name: skill.name,
            level: r?.level ?? "not_enough_evidence",
            summary: r?.summary ?? "No answer clearly showed this skill yet.",
            quote: r?.evidence[0]?.quote ?? null,
            form: r?.evidence[0]?.form ? shortFormName(r.evidence[0].form) : null,
          };
        }),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  // One course: its own rating overview already summarizes it. Several:
  // write one combined overview across them.
  const overview =
    courses.length === 1
      ? courses[0].overview
      : await generateLearnerOverview({ learnerName: learner.display_name, courses });

  const data: LearnerReportData = {
    learnerName: learner.display_name,
    externalReference: learner.external_reference,
    courses,
    overview,
  };

  const buffer = await renderToBuffer(<LearnerReportDocument data={data} />);
  const fileStem = environmentId && courses[0] ? `${learner.display_name} ${courses[0].code}` : learner.display_name;
  const fileName = `${fileStem.replace(/[^a-z0-9]+/gi, "-")}-insights.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

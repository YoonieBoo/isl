import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { LearnerReportDocument, type LearnerReportData } from "@/lib/pdf/learner-report";
import { generateLearnerOverview } from "@/lib/pdf/learner-overview";

export const dynamic = "force-dynamic";

// "DDI2331 Design Thinking" -> "DDI2331"; names without a course code are kept as-is.
function courseCode(name: string): string {
  return name.match(/\b[A-Z]{2,}\s?\d{3,}[A-Z]?\b/)?.[0] ?? name;
}

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
    .select("observed_strengths, development_needs, learning_preferences")
    .eq("learner_id", id)
    .eq("status", "approved");
  if (environmentId) {
    environmentsQuery = environmentsQuery.eq("environment_id", environmentId);
    insightsQuery = insightsQuery.eq("environment_id", environmentId);
  }

  const [{ data: learner, error }, { data: environments }, { data: approvedInsights }] = await Promise.all([
    supabase.from("learners").select("display_name, external_reference").eq("id", id).single(),
    environmentsQuery,
    insightsQuery,
  ]);

  if (error || !learner) {
    return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  }

  const strengths = [...new Set((approvedInsights ?? []).flatMap((i) => i.observed_strengths))];
  const developmentNeeds = [...new Set((approvedInsights ?? []).flatMap((i) => i.development_needs))];
  const learningPreferences = [...new Set((approvedInsights ?? []).flatMap((i) => i.learning_preferences))];
  const environmentNames = (environments ?? [])
    .map((e) => e.learning_environments?.name)
    .filter((n): n is string => Boolean(n))
    .map(courseCode);

  const overview = await generateLearnerOverview({
    learnerName: learner.display_name,
    strengths,
    developmentNeeds,
    learningPreferences,
    environments: environmentNames,
  });

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
  const fileStem = environmentId && environmentNames[0]
    ? `${learner.display_name} ${environmentNames[0]}`
    : learner.display_name;
  const fileName = `${fileStem.replace(/[^a-z0-9]+/gi, "-")}-insights.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

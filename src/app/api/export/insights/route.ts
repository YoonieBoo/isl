import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/export/insights?environment=<id>&learner=<id>
// Exports approved learner insight as structured JSON (spec §12.14, §3
// "Export → export approved structured output, reuse insight in teaching,
// learner support, or downstream analysis"). Only ever includes insights
// with status = 'approved' — candidate/under_review output is never exported.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "analyst", "educator"].includes(profile.role)) {
    return NextResponse.json({ error: "Not authorized to export." }, { status: 403 });
  }

  const environmentId = request.nextUrl.searchParams.get("environment");
  const learnerId = request.nextUrl.searchParams.get("learner");

  let query = supabase
    .from("learner_insights")
    .select(
      "id, title, summary, observed_strengths, development_needs, learning_preferences, concerns, interpretation_boundary, approved_at, learners(id, display_name, external_reference), learning_environments(id, name), insight_evidence(evidence_text)",
    )
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (environmentId) query = query.eq("environment_id", environmentId);
  if (learnerId) query = query.eq("learner_id", learnerId);

  const { data: insights, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportedBy: user.email,
    filters: { environmentId, learnerId },
    count: insights?.length ?? 0,
    insights,
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="isl-approved-insights-${Date.now()}.json"`,
    },
  });
}

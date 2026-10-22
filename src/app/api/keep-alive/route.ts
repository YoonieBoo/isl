import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Called once a day by a Vercel cron (vercel.json). Supabase's free plan
// pauses a project after about a week without activity, which takes the whole
// site down until someone restores it by hand — a tiny daily query prevents
// that. It reads nothing sensitive: signed out, row-level security returns no rows.
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("learning_environments").select("id").limit(1);
  return NextResponse.json({ ok: !error, at: new Date().toISOString() }, { status: error ? 500 : 200 });
}

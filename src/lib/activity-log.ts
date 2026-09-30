import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export async function logActivity(
  supabase: SupabaseClient<Database>,
  actor: string,
  actionType: string,
  targetType: string,
  targetId: string,
  summary: string,
) {
  await supabase.from("activity_log").insert({
    actor,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    summary,
  });
}

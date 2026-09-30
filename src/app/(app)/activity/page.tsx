import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ListIcon } from "@/components/icons";

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("activity_log")
    .select("id, action_type, target_type, summary, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <PageHeader
        title="Activity"
        icon={ListIcon}
        description="Everything that's happened on the platform — created, uploaded, validated, run, reviewed, approved."
      />

      <div className="mt-6">
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!error && entries && entries.length === 0 && (
          <EmptyState title="No activity yet" description="Actions across the platform will show up here." />
        )}

        {entries && entries.length > 0 && (
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{e.profiles?.display_name ?? "Unknown"}</span>{" "}
                    <span className="text-foreground-muted">{e.summary}</span>
                  </div>
                  <span className="shrink-0 text-xs text-foreground-muted">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

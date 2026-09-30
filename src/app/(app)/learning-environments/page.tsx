import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { BookOpenIcon } from "@/components/icons";

export default async function LearningEnvironmentsPage() {
  const supabase = await createClient();
  const { data: environments, error } = await supabase
    .from("learning_environments")
    .select("id, name, organisation_name, course_or_workshop, status, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Learning Environments"
        description="Course or workshop contexts that datasets and processing runs are scoped to."
        icon={BookOpenIcon}
        action={
          <Link href="/learning-environments/new">
            <PrimaryButton>New environment</PrimaryButton>
          </Link>
        }
      />

      <div className="mt-6">
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!error && environments && environments.length === 0 && (
          <EmptyState
            title="No learning environments yet"
            description="Create one to start uploading learner datasets and running SmartDiscovery processing."
            action={
              <Link href="/learning-environments/new">
                <PrimaryButton>New environment</PrimaryButton>
              </Link>
            }
          />
        )}

        {environments && environments.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Organisation</th>
                  <th className="px-5 py-3">Course / Workshop</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Record updated</th>
                </tr>
              </thead>
              <tbody>
                {environments.map((env) => (
                  <tr key={env.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/learning-environments/${env.id}`}
                        className="font-medium text-isl-blue hover:underline"
                      >
                        {env.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {env.organisation_name}
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {env.course_or_workshop}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={env.status === "active" ? "success" : "neutral"}>
                        {env.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {new Date(env.updated_at).toLocaleString()}
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

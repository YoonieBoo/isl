import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { PortfolioForm } from "@/app/(app)/portfolios/new/portfolio-form";

export default async function NewPortfolioArtifactPage({
  searchParams,
}: PageProps<"/portfolios/new">) {
  const { learner } = await searchParams;
  const defaultLearnerId = typeof learner === "string" ? learner : undefined;

  const supabase = await createClient();
  const [{ data: learners }, { data: environments }] = await Promise.all([
    supabase.from("learners").select("id, display_name").eq("status", "active").order("display_name"),
    supabase.from("learning_environments").select("id, name").eq("status", "active").order("name"),
  ]);

  return (
    <div>
      <PageHeader title="Add Portfolio Artifact" />
      <Card className="mt-6 max-w-xl">
        <PortfolioForm
          learners={learners ?? []}
          environments={environments ?? []}
          defaultLearnerId={defaultLearnerId}
        />
      </Card>
    </div>
  );
}

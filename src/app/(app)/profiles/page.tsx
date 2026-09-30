import { redirect } from "next/navigation";

// The Profiles list duplicated the Learners list (same people, same "click
// through to see more" pattern) — Learners is now the one place to browse
// learners; a learner's own profile is still reachable from their page.
export default async function ProfilesPage({
  searchParams,
}: PageProps<"/profiles">) {
  const { environment } = await searchParams;
  const environmentId = typeof environment === "string" ? environment : undefined;
  redirect(environmentId ? `/learners?environment=${environmentId}` : "/learners");
}

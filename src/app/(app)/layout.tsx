import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // src/proxy.ts already redirects unauthenticated requests to /login;
  // this is the defense-in-depth check for the Server Component render itself.
  if (!user) {
    redirect("/login");
  }

  return <AppShell userEmail={user.email ?? "Unknown"}>{children}</AppShell>;
}

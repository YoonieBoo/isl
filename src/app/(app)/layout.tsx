import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { IslLogo } from "@/components/isl-logo";
import { signOut } from "@/app/actions/auth";

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

  // The app is for staff only (admin / analyst / educator). Learner accounts
  // must not see course creation or editing — there is no student view yet,
  // so they get a plain holding page instead of the staff screens.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "learner") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
          <IslLogo className="text-3xl" />
          <p className="mt-4 text-sm text-foreground">This account doesn&apos;t have access to the instructor tools.</p>
          <p className="mt-1 text-sm text-foreground-muted">If you think it should, please ask an admin.</p>
          <form action={signOut} className="mt-5">
            <button
              type="submit"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-muted hover:bg-surface-pale hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AppShell userEmail={user.email ?? "Unknown"}>{children}</AppShell>;
}

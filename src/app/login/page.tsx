import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return <LoginForm next={next} />;
}

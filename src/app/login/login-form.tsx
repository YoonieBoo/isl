"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/actions/auth";
import { IslLogo } from "@/components/isl-logo";
import { ChevronDownIcon } from "@/components/icons";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const action = mode === "sign-in" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<
    AuthFormState,
    FormData
  >(action, undefined);

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <IslLogo className="text-3xl" />
          <p className="mt-2 text-sm text-foreground-muted">
            Learner Intelligence Platform
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold text-foreground">
            {mode === "sign-in" ? "Sign in" : "Create an account"}
          </h1>

          <form action={formAction} className="mt-5 space-y-4">
            <input type="hidden" name="next" value={next} />

            {mode === "sign-up" && (
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-foreground"
                >
                  Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-isl-blue"
                />
              </div>
            )}

            {mode === "sign-up" && (
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-foreground">
                  Role
                </label>
                <div className="relative mt-1">
                <select
                  id="role"
                  name="role"
                  required
                  defaultValue=""
                  className="w-full appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-9 text-sm outline-none focus:border-isl-blue"
                >
                  <option value="" disabled>
                    Select a role
                  </option>
                  <option value="admin">Admin — project owner</option>
                  <option value="analyst">Analyst — research / data</option>
                  <option value="educator">Educator — instructor / reviewer</option>
                  <option value="learner">Learner — student</option>
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-isl-blue"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-isl-blue"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-danger">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-isl-blue px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-isl-blue-dark disabled:opacity-60"
            >
              {pending
                ? "Please wait…"
                : mode === "sign-in"
                  ? "Sign in"
                  : "Sign up"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-foreground-muted">
          {mode === "sign-in" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("sign-up")}
                className="font-medium text-isl-blue hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("sign-in")}
                className="font-medium text-isl-blue hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

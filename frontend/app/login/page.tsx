"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api/types";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto w-full max-w-md py-16" aria-hidden="true">
      <div className="rounded-card border border-border bg-card p-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-3.5 w-64" />
        <div className="mt-6 space-y-4">
          <div>
            <Skeleton className="mb-1.5 h-2.5 w-12" />
            <Skeleton className="h-9 w-full rounded-chip" />
          </div>
          <div>
            <Skeleton className="mb-1.5 h-2.5 w-16" />
            <Skeleton className="h-9 w-full rounded-chip" />
          </div>
          <Skeleton className="h-10 w-full rounded-chip" />
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { status, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, router, next]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors({
        email: errors.email?.[0],
        password: errors.password?.[0],
      });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const me = await login(result.data.email, result.data.password);
      router.replace(me.role === "ADMIN" ? "/admin" : next);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Couldn't log you in — please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Container size="sm" className="py-16">
      <div className="mx-auto max-w-md">
        <Card>
          <div className="mb-6 text-center">
            <h1 className="text-page-title font-bold text-text">Welcome back</h1>
            <p className="mt-2 text-default text-text-muted">
              Log in to manage your bookings and payments.
            </p>
          </div>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rahim@example.com"
              error={fieldErrors.email}
              required
            />
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              error={fieldErrors.password}
              required
            />
            {formError && (
              <p className="text-default text-danger">{formError}</p>
            )}
            <Button type="submit" fullWidth loading={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-default text-text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-emerald hover:underline"
            >
              Create one
            </Link>
          </p>
        </Card>
      </div>
    </Container>
  );
}
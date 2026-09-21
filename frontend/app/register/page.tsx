"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api/types";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name (2+ characters)."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Use digits, optionally with + and dashes."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Include at least one uppercase letter.")
    .regex(/[0-9]/, "Include at least one number."),
});

export default function RegisterPage() {
  const { status, register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = registerSchema.safeParse({ name, email, phone, password });
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors({
        name: errors.name?.[0],
        email: errors.email?.[0],
        phone: errors.phone?.[0],
        password: errors.password?.[0],
      });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const me = await register(
        result.data.name,
        result.data.email,
        result.data.phone,
        result.data.password,
      );
      router.replace(me.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Couldn't create your account — please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Container size="sm" className="py-16">
      <div className="mx-auto max-w-md">
        <Card>
          <div className="mb-6 text-center">
            <h1 className="text-page-title font-bold text-text">
              Create your account
            </h1>
            <p className="mt-2 text-default text-text-muted">
              Sign up to start reserving Hajj & Umrah packages.
            </p>
          </div>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              id="name"
              type="text"
              label="Full name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rahim Ahmed"
              error={fieldErrors.name}
              required
            />
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
              id="phone"
              type="tel"
              label="Phone"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8801700000000"
              error={fieldErrors.phone}
              required
            />
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              hint="At least 8 chars, one uppercase, one number"
              error={fieldErrors.password}
              required
            />
            {formError && (
              <p className="text-default text-danger">{formError}</p>
            )}
            <Button type="submit" fullWidth loading={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-default text-text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald hover:underline"
            >
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </Container>
  );
}
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const validationErrors = Array.isArray(data.errors)
          ? data.errors
              .map((item: { message?: string }) => item.message)
              .filter(Boolean)
              .join(" ")
          : "";

        throw new Error(
          validationErrors ||
            data.message ||
            "Unable to create your account."
        );
      }

      if (typeof data.token !== "string" || !data.token) {
        throw new Error(
          "Account creation response did not include an authentication token."
        );
      }

      localStorage.setItem("trustlens_token", data.token);

      setSuccess("Account created successfully! Redirecting...");

      window.setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080b14] px-5 py-12 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#101522]/95 p-7 shadow-2xl sm:p-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-2xl">
            🛡️
          </div>

          <div>
            <p className="text-xl font-bold">
              TrustLens<span className="text-cyan-400"> AI</span>
            </p>

            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Digital Trust Intelligence
            </p>
          </div>
        </Link>

        <div className="mt-9">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
            Get started
          </p>

          <h1 className="mt-3 text-3xl font-bold">Create your account</h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Create an account to investigate suspicious digital content and
            access your scan history.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Full name
            </label>

            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            />

            <p className="mt-2 text-xs text-slate-500">
              Use at least 8 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Confirm password
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm leading-6 text-red-300"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300"
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-5 py-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account →"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-cyan-400 hover:text-cyan-300"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-6 text-center text-xs leading-6 text-slate-500">
          TrustLens AI provides risk assessments, not guarantees. Never share
          your OTP or banking password with untrusted parties.
        </p>
      </section>
    </main>
  );
}
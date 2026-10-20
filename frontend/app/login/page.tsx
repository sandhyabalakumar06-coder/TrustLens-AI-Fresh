"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed. Please try again.");
      }

      const token =
        data.token ??
        data.accessToken ??
        data.data?.token ??
        data.data?.accessToken;

      if (typeof token !== "string" || token.length === 0) {
        throw new Error(
          "Login succeeded, but the authentication token was not found. Please check the backend login response."
        );
      }

      // Save the authentication token
      localStorage.setItem("trustlens_token", token);

      // Redirect to Dashboard after successful login
      router.replace("/dashboard");
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
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[130px]" />

        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      {/* Login card */}
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#101522]/95 p-7 shadow-2xl sm:p-10">
        {/* Logo */}
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

        {/* Heading */}
        <div className="mt-9">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
            Welcome back
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Sign in to TrustLens
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in to investigate suspicious links, emails, and messages and
            save your scan history.
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {/* Email */}
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            />
          </div>

          {/* Password */}
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm leading-6 text-red-300"
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-5 py-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-cyan-400 hover:text-cyan-300"
          >
            Create account
          </Link>
        </p>

        {/* Security notice */}
        <p className="mt-6 text-center text-xs leading-6 text-slate-500">
          Never share your password, OTP, or banking credentials with
          untrusted parties.
        </p>
      </section>
    </main>
  );
}
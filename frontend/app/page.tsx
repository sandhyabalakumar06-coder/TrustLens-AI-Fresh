import Link from "next/link";
import Analyzer from "@/components/Analyzer";
import DashboardLink from "@/components/DashboardLink";

const features = [
  {
    number: "01",
    icon: "🌐",
    title: "Website Scanner",
    description:
      "Analyze URLs for suspicious links, misleading domains, and common phishing indicators.",
    tag: "URL ANALYSIS",
  },
  {
    number: "02",
    icon: "📧",
    title: "Email Phishing",
    description:
      "Review email content for suspicious requests, urgency, and possible impersonation.",
    tag: "EMAIL SECURITY",
  },
  {
    number: "03",
    icon: "💬",
    title: "Message Analyzer",
    description:
      "Check suspicious messages in English, Tamil, and Tanglish for common scam indicators.",
    tag: "MULTILINGUAL",
  },
  {
    number: "04",
    icon: "📱",
    title: "QR Code Scanner",
    description:
      "Inspect QR code contents for potentially suspicious URLs and unexpected destinations.",
    tag: "QR SECURITY",
  },
  {
    number: "05",
    icon: "🧾",
    title: "Payment Screenshot",
    description:
      "Extract visible payment details and look for inconsistencies in screenshot content.",
    tag: "OCR ANALYSIS",
  },
  {
    number: "06",
    icon: "📄",
    title: "Document Analyzer",
    description:
      "Review document text for suspicious payment requests, OTP requests, and other warning signs.",
    tag: "DOCUMENT REVIEW",
  },
];

const steps = [
  {
    number: "01",
    title: "Submit content",
    description: "Enter a URL, email, or message you want to check.",
  },
  {
    number: "02",
    title: "Analyze indicators",
    description:
      "TrustLens checks for configured suspicious patterns and available evidence.",
  },
  {
    number: "03",
    title: "Review the result",
    description:
      "Read the trust score, detected indicators, and recommended safety actions.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070b14] text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#070b14]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-xl font-black text-slate-950">
              T
            </div>

            <div>
              <p className="text-lg font-bold tracking-tight">
                TrustLens <span className="text-cyan-400">AI</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Digital Trust Intelligence
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-cyan-400">
              Features
            </a>

            <a
              href="#how-it-works"
              className="transition hover:text-cyan-400"
            >
              How it works
            </a>

            <a href="#analyzer" className="transition hover:text-cyan-400">
              Scanner
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Dashboard button: visible when a login token exists */}
            <DashboardLink />

            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:text-white"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center">
        <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]" />

        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-violet-500/10 blur-[100px]" />

        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-medium text-cyan-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            AI-POWERED DIGITAL SAFETY
          </div>

          <h1 className="max-w-2xl text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Trust less.
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Verify more.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
            Suspicious links, phishing emails, and scam messages can look
            convincing. TrustLens AI helps you inspect digital content, identify
            warning signs, and make safer decisions.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#analyzer"
              className="rounded-xl bg-cyan-400 px-6 py-3.5 font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              Analyze Content →
            </a>

            <a
              href="#features"
              className="rounded-xl border border-white/15 px-6 py-3.5 font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:bg-white/5"
            >
              Explore Features
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400">
            <span>✓ Evidence-based indicators</span>
            <span>✓ Tamil + English + Tanglish</span>
            <span>✓ Safety recommendations</span>
          </div>
        </div>

        {/* Illustrative preview card */}
        <div className="relative z-10 mx-auto w-full max-w-lg">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-cyan-500/10 to-violet-500/10 blur-2xl" />

          <div className="relative rounded-3xl border border-white/10 bg-[#0c1321]/95 p-6 shadow-2xl shadow-black/40 sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-sm font-semibold text-white">
                  Trust Assessment
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Illustrative preview
                </p>
              </div>

              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                DEMO
              </span>
            </div>

            <div className="py-8 text-center">
              <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-[8px] border-slate-800">
                <div>
                  <p className="text-4xl font-black text-cyan-400">--</p>
                  <p className="mt-1 text-xs text-slate-500">Not checked</p>
                </div>
              </div>

              <p className="mt-5 text-lg font-bold text-white">
                Your result appears here
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Submit content using the scanner below.
              </p>
            </div>

            <div className="space-y-3">
              {[
                ["URL indicators", "Awaiting scan"],
                ["Message indicators", "Awaiting scan"],
                ["Safety recommendations", "Awaiting scan"],
              ].map(([label, status]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3"
                >
                  <span className="text-sm text-slate-300">{label}</span>
                  <span className="text-xs text-slate-500">{status}</span>
                </div>
              ))}
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              A preview only. No scan has been performed in this card.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section
        id="features"
        className="border-y border-white/5 bg-[#0a101c] px-5 py-20 sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
              Platform capabilities
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              One platform. Multiple layers of protection.
            </h2>

            <p className="mt-5 leading-7 text-slate-400">
              Inspect different types of digital content and understand which
              warning signs were detected.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="group rounded-2xl border border-white/10 bg-[#0d1523] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-[#101b2b]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{feature.icon}</span>

                  <span className="text-sm font-medium text-slate-600">
                    {feature.number}
                  </span>
                </div>

                <p className="mt-6 text-[10px] font-bold tracking-[0.2em] text-cyan-400">
                  {feature.tag}
                </p>

                <h3 className="mt-2 text-xl font-bold text-white">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
      >
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
            Simple workflow
          </p>

          <h2 className="mt-4 text-3xl font-black sm:text-4xl">
            How TrustLens works
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-7"
            >
              <span className="text-sm font-bold tracking-widest text-cyan-400">
                STEP {step.number}
              </span>

              <h3 className="mt-4 text-xl font-bold">{step.title}</h3>

              <p className="mt-3 text-sm leading-7 text-slate-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Working Analyzer */}
      <section
        id="analyzer"
        className="border-y border-white/5 bg-[#0a101c] px-4 py-12 sm:px-8 sm:py-16"
      >
        <Analyzer />
      </section>

      {/* Disclaimer */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 sm:p-6">
          <h2 className="font-bold text-amber-300">
            Important safety notice
          </h2>

          <p className="mt-2 text-sm leading-7 text-slate-400">
            TrustLens AI uses configured indicators and heuristic scoring.
            Scores are not statistically calibrated probabilities, and a low
            risk score does not prove that content is safe. Never share your
            password, OTP, PIN, or banking credentials in response to an
            unexpected request. Verify important requests through official
            channels.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} TrustLens AI. Digital trust starts
            with verification.
          </p>

          <div className="flex gap-5">
            <Link
              href="/login"
              className="transition hover:text-cyan-400"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="transition hover:text-cyan-400"
            >
              Register
            </Link>

            <Link
              href="/dashboard"
              className="transition hover:text-cyan-400"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
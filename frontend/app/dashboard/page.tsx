"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Scan = {
  id: string;
  type: string;
  status: string;
  inputSummary: string;
  trustScore: number | null;
  scamProbability: number | null;
  threatCategory: string | null;
  explanation?: string | null;
  evidence?: unknown;
  recommendations?: unknown;
  createdAt: string;
};

type HistoryResponse = {
  success: boolean;
  data?: Scan[] | { scans?: Scan[]; items?: Scan[] };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
};

type AnalyticsData = {
  totalScans: number;
  averageTrustScore: number | null;
  scoredScansCount: number;
  riskDistribution: {
    high: number;
    suspicious: number;
    low: number;
    unscored: number;
  };
  scanTypeCounts: Record<string, number>;
  recentScans: Scan[];
  disclaimer?: string;
};

type AnalyticsResponse = {
  success: boolean;
  data?: AnalyticsData;
  message?: string;
};

type DeleteResponse = {
  success: boolean;
  message?: string;
};

function getScans(data: HistoryResponse): Scan[] {
  if (Array.isArray(data.data)) return data.data;

  if (data.data && !Array.isArray(data.data)) {
    if (Array.isArray(data.data.scans)) return data.data.scans;
    if (Array.isArray(data.data.items)) return data.data.items;
  }

  return [];
}

function getRiskLabel(score: number | null): string {
  if (score === null) return "Not scored";
  if (score >= 60) return "High risk indicators";
  if (score >= 20) return "Suspicious indicators";
  return "Few indicators detected";
}

function getRiskColor(score: number | null): string {
  if (score === null) {
    return "text-slate-400 border-slate-700 bg-slate-500/5";
  }

  if (score >= 60) {
    return "text-red-300 border-red-500/30 bg-red-500/10";
  }

  if (score >= 20) {
    return "text-amber-300 border-amber-500/30 bg-amber-500/10";
  }

  return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
}

function getEvidenceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): string => {
      if (typeof item === "string") return item;

      if (
        typeof item === "object" &&
        item !== null &&
        "indicator" in item &&
        typeof item.indicator === "string"
      ) {
        return item.indicator;
      }

      return "";
    })
    .filter(Boolean);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function formatType(type: string): string {
  return type.replaceAll("_", " ");
}

function riskBarWidth(count: number, total: number): string {
  if (total <= 0 || count <= 0) return "0%";
  return `${Math.min(100, (count / total) * 100)}%`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [scans, setScans] = useState<Scan[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");

  const logout = useCallback(() => {
    localStorage.removeItem("trustlens_token");
    setSelectedScan(null);
    router.replace("/login");
  }, [router]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = localStorage.getItem("trustlens_token");

    if (!token) {
      router.replace("/login");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/history?page=${page}&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      const data = (await response.json()) as HistoryResponse;

      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load scan history.");
      }

      const loadedScans = getScans(data);

      setScans(loadedScans);
      setTotal(data.pagination?.total ?? loadedScans.length);
      setTotalPages(Math.max(1, data.pagination?.totalPages ?? 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }, [page, router, logout]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");

    const token = localStorage.getItem("trustlens_token");

    if (!token) {
      router.replace("/login");
      setAnalyticsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/history/analytics`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      const result = (await response.json()) as AnalyticsResponse;

      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }

      if (!response.ok || !result.success || !result.data) {
        throw new Error(
          result.message || "Could not load dashboard analytics."
        );
      }

      setAnalytics(result.data);
    } catch (err) {
      setAnalyticsError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics."
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [router, logout]);

  // Delete one scan, then reload history and analytics.
  const handleDelete = useCallback(
    async (scanId: string) => {
      const confirmed = window.confirm(
        "Are you sure you want to delete this scan from your history? This action cannot be undone."
      );

      if (!confirmed) return;

      const token = localStorage.getItem("trustlens_token");

      if (!token) {
        setError("Please log in again to delete scan history.");
        router.replace("/login");
        return;
      }

      setDeleting(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/api/history/${encodeURIComponent(scanId)}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = (await response.json()) as DeleteResponse;

        if (response.status === 401 || response.status === 403) {
          logout();
          return;
        }

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to delete scan.");
        }

        setSelectedScan(null);

        await Promise.all([loadHistory(), loadAnalytics()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to delete scan."
        );
      } finally {
        setDeleting(false);
      }
    },
    [loadHistory, loadAnalytics, logout, router]
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const filteredScans = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return scans.filter((scan) => {
      const summary = (scan.inputSummary ?? "").toLowerCase();
      const type = formatType(scan.type).toLowerCase();
      const category = (scan.threatCategory ?? "").toLowerCase();

      const matchesSearch =
        query.length === 0 ||
        summary.includes(query) ||
        type.includes(query) ||
        category.includes(query);

      const matchesType =
        typeFilter === "ALL" || scan.type === typeFilter;

      const score = scan.scamProbability;

      let matchesRisk = true;

      if (riskFilter === "HIGH") {
        matchesRisk = score !== null && score >= 60;
      } else if (riskFilter === "SUSPICIOUS") {
        matchesRisk = score !== null && score >= 20 && score < 60;
      } else if (riskFilter === "LOW") {
        matchesRisk = score !== null && score < 20;
      } else if (riskFilter === "UNSCORED") {
        matchesRisk = score === null;
      }

      return matchesSearch && matchesType && matchesRisk;
    });
  }, [scans, searchTerm, typeFilter, riskFilter]);

  function resetFilters() {
    setSearchTerm("");
    setTypeFilter("ALL");
    setRiskFilter("ALL");
  }

  function refreshDashboard() {
    void loadHistory();
    void loadAnalytics();
  }

  const riskDistribution = analytics?.riskDistribution;

  const distributionTotal = riskDistribution
    ? riskDistribution.high +
      riskDistribution.suspicious +
      riskDistribution.low +
      riskDistribution.unscored
    : 0;

  const scanTypeLabels: Record<string, string> = {
    URL: "Website URL",
    EMAIL: "Email",
    MESSAGE: "Message",
    QR_CODE: "QR Code",
    PAYMENT_SCREENSHOT: "Payment Screenshot",
    DOCUMENT: "Document",
    IMAGE: "Image",
  };

  const scanTypeColors: Record<string, string> = {
    URL: "bg-cyan-400",
    EMAIL: "bg-violet-400",
    MESSAGE: "bg-blue-400",
    QR_CODE: "bg-emerald-400",
    PAYMENT_SCREENSHOT: "bg-amber-400",
    DOCUMENT: "bg-pink-400",
    IMAGE: "bg-indigo-400",
  };

    return (
    <main className="min-h-screen bg-[#070b14] text-white">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -right-40 top-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-xl">
                🛡️
              </span>

              <span className="text-2xl font-bold tracking-tight">
                TrustLens <span className="text-cyan-400">AI</span>
              </span>
            </Link>

            <p className="mt-3 text-sm text-slate-400">
              Your digital trust and scam intelligence dashboard
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/scanner"
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              + New Scan
            </Link>

            <button
              type="button"
              onClick={refreshDashboard}
              disabled={loading || analyticsLoading}
              className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↻ Refresh
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Welcome section */}
        <section className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Security overview
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your Trust Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Review your previous scans, understand detected risk indicators,
            and monitor your digital safety activity in one place.
          </p>
        </section>

        {/* Error messages */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="self-start font-semibold underline sm:self-auto"
            >
              Dismiss
            </button>
          </div>
        )}

        {analyticsError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
          >
            Analytics unavailable: {analyticsError}
          </div>
        )}

        {/* Summary cards */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Total scans */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Scans</p>
              <span className="text-xl">🔎</span>
            </div>

            <p className="mt-4 text-4xl font-bold">
              {analyticsLoading ? "—" : (analytics?.totalScans ?? total)}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Scans recorded in your account
            </p>
          </div>

          {/* Average trust score */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Average Trust Score</p>
              <span className="text-xl">🛡️</span>
            </div>

            <p className="mt-4 text-4xl font-bold text-cyan-300">
              {analyticsLoading
                ? "—"
                : analytics?.averageTrustScore == null
                  ? "N/A"
                  : `${Math.round(analytics.averageTrustScore)}/100`}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Based on scans with an available score
            </p>
          </div>

          {/* High risk */}
          <div className="rounded-2xl border border-red-500/20 bg-slate-900/70 p-5 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">High-Risk Indicators</p>
              <span className="text-xl">⚠️</span>
            </div>

            <p className="mt-4 text-4xl font-bold text-red-300">
              {analyticsLoading
                ? "—"
                : (riskDistribution?.high ?? 0)}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Scans with scam probability of 60% or higher
            </p>
          </div>

          {/* Suspicious */}
          <div className="rounded-2xl border border-amber-500/20 bg-slate-900/70 p-5 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Suspicious Indicators</p>
              <span className="text-xl">🔔</span>
            </div>

            <p className="mt-4 text-4xl font-bold text-amber-300">
              {analyticsLoading
                ? "—"
                : (riskDistribution?.suspicious ?? 0)}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Scans with scam probability between 20% and 59%
            </p>
          </div>
        </section>

        {/* Analytics */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Risk distribution */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold">Risk Distribution</h2>

              <p className="mt-1 text-sm text-slate-400">
                Overview of the risk indicators detected across your scans.
              </p>
            </div>

            {analyticsLoading ? (
              <div className="space-y-5">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item}>
                    <div className="mb-2 h-3 w-32 animate-pulse rounded bg-slate-800" />
                    <div className="h-2 animate-pulse rounded bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {[
                  {
                    label: "High Risk",
                    count: riskDistribution?.high ?? 0,
                    color: "bg-red-400",
                    textColor: "text-red-300",
                  },
                  {
                    label: "Suspicious",
                    count: riskDistribution?.suspicious ?? 0,
                    color: "bg-amber-400",
                    textColor: "text-amber-300",
                  },
                  {
                    label: "Low Risk",
                    count: riskDistribution?.low ?? 0,
                    color: "bg-emerald-400",
                    textColor: "text-emerald-300",
                  },
                  {
                    label: "Not Scored",
                    count: riskDistribution?.unscored ?? 0,
                    color: "bg-slate-500",
                    textColor: "text-slate-300",
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-300">{item.label}</span>

                      <span className={`font-semibold ${item.textColor}`}>
                        {item.count}
                      </span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                        style={{
                          width: riskBarWidth(
                            item.count,
                            distributionTotal
                          ),
                        }}
                      />
                    </div>
                  </div>
                ))}

                {distributionTotal === 0 && (
                  <p className="pt-2 text-sm text-slate-500">
                    No scan analytics available yet. Run your first scan to
                    see the results here.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Scan type breakdown */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold">Scan Type Breakdown</h2>

              <p className="mt-1 text-sm text-slate-400">
                Types of content you have checked using TrustLens AI.
              </p>
            </div>

            {analyticsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-24 animate-pulse rounded-xl bg-slate-800"
                  />
                ))}
              </div>
            ) : Object.keys(analytics?.scanTypeCounts ?? {}).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                <p className="text-sm text-slate-400">
                  No scan type data available yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(analytics?.scanTypeCounts ?? {}).map(
                  ([type, count]) => (
                    <div
                      key={type}
                      className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            scanTypeColors[type] ?? "bg-slate-400"
                          }`}
                        />

                        <span className="text-sm text-slate-300">
                          {scanTypeLabels[type] ?? formatType(type)}
                        </span>
                      </div>

                      <p className="text-2xl font-bold">{count}</p>

                      <p className="mt-1 text-xs text-slate-500">
                        Recorded scans
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        {/* Recent activity */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Recent Activity</h2>

              <p className="mt-1 text-sm text-slate-400">
                Your latest five recorded scans.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setTypeFilter("ALL");
                setRiskFilter("ALL");
              }}
              className="self-start text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              View all scans ↓
            </button>
          </div>

          {analyticsLoading ? (
            <p className="text-sm text-slate-400">Loading recent activity...</p>
          ) : !analytics?.recentScans?.length ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
              No recent scans yet.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.recentScans.map((scan) => (
                <button
                  type="button"
                  key={scan.id}
                  onClick={() => setSelectedScan(scan)}
                  className="flex w-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:border-cyan-400/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-200">
                      {scan.inputSummary || "No summary available"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatType(scan.type)} · {formatDate(scan.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskColor(
                        scan.scamProbability
                      )}`}
                    >
                      {getRiskLabel(scan.scamProbability)}
                    </span>

                    <span className="text-sm font-semibold text-slate-300">
                      {scan.trustScore == null
                        ? "No score"
                        : `Trust ${scan.trustScore}/100`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Scan history */}
        <section
          id="scan-history"
          className="scroll-mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6"
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Scan History</h2>

              <p className="mt-1 text-sm text-slate-400">
                Search, filter, and inspect your previous scan results.
              </p>
            </div>

            <span className="self-start rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300">
              {total} total records
            </span>
          </div>

          {/* Search and filters */}
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search URL, category, type..."
              aria-label="Search scan history"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter by scan type"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="ALL">All scan types</option>
              {Object.entries(scanTypeLabels).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value)}
              aria-label="Filter by risk level"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="ALL">All risk levels</option>
              <option value="HIGH">High risk</option>
              <option value="SUSPICIOUS">Suspicious</option>
              <option value="LOW">Low risk</option>
              <option value="UNSCORED">Not scored</option>
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:text-white"
            >
              Reset Filters
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-xl bg-slate-800/70"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
              Unable to load scan history. Check that the backend is running
              and try refreshing the dashboard.
            </div>
          )}

          {/* Empty history */}
          {!loading && !error && scans.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
              <div className="mb-3 text-4xl">🔍</div>

              <h3 className="font-semibold">No scans found</h3>

              <p className="mt-2 text-sm text-slate-400">
                Your scan history will appear here after you complete a scan.
              </p>

              <Link
                href="/scanner"
                className="mt-5 inline-flex rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
              >
                Start Your First Scan
              </Link>
            </div>
          )}

          {/* No filter results */}
          {!loading && !error && scans.length > 0 && filteredScans.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <p className="font-semibold">No matching scans</p>

              <p className="mt-2 text-sm text-slate-400">
                Try changing your search term or filters.
              </p>

              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* History records */}
          {!loading && !error && filteredScans.length > 0 && (
            <div className="space-y-3">
              {filteredScans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-cyan-300">
                        {formatType(scan.type)}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskColor(
                          scan.scamProbability
                        )}`}
                      >
                        {getRiskLabel(scan.scamProbability)}
                      </span>
                    </div>

                    <p className="break-words font-semibold text-slate-100">
                      {scan.inputSummary || "No summary available"}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(scan.createdAt)}
                    </p>

                    {scan.threatCategory && (
                      <p className="mt-2 text-sm text-slate-400">
                        Category: {scan.threatCategory}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-24 text-left sm:text-right">
                      <p className="text-xs text-slate-500">Trust score</p>

                      <p className="mt-1 text-lg font-bold text-cyan-300">
                        {scan.trustScore == null
                          ? "N/A"
                          : `${scan.trustScore}/100`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedScan(scan)}
                      className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                    >
                      View Details
                    </button>

                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void handleDelete(scan.id)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && scans.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                Page {page} of {totalPages} · {total} records
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <footer className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs leading-6 text-slate-500">
            <strong className="text-slate-400">Safety notice:</strong>{" "}
            TrustLens AI provides automated risk indicators for informational
            purposes. A low risk score does not guarantee that content is safe,
            and a high score does not by itself prove fraud. Verify suspicious
            requests independently before sharing personal information or
            sending money.
          </p>

          {analytics?.disclaimer && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {analytics.disclaimer}
            </p>
          )}
        </footer>
      </div>

      {/* Scan details modal */}
      {selectedScan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setSelectedScan(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-details-title"
            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0b1220] p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                  Scan report
                </p>

                <h2
                  id="scan-details-title"
                  className="mt-2 text-2xl font-bold"
                >
                  Scan Details
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  {formatDate(selectedScan.createdAt)}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close scan details"
                disabled={deleting}
                onClick={() => setSelectedScan(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-500">Scan type</p>

                <p className="mt-2 font-semibold">
                  {formatType(selectedScan.type)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-500">Trust score</p>

                <p className="mt-2 text-xl font-bold text-cyan-300">
                  {selectedScan.trustScore == null
                    ? "N/A"
                    : `${selectedScan.trustScore}/100`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-500">Scam probability</p>

                <p className="mt-2 text-xl font-bold text-amber-300">
                  {selectedScan.scamProbability == null
                    ? "N/A"
                    : `${selectedScan.scamProbability}%`}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Input summary
              </p>

              <p className="mt-2 break-words text-sm leading-6 text-slate-200">
                {selectedScan.inputSummary || "No summary available"}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Threat category
              </p>

              <p className="mt-2 text-sm text-slate-200">
                {selectedScan.threatCategory || "Not classified"}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Explanation
              </p>

              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                {selectedScan.explanation ||
                  "No detailed explanation is available for this scan."}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detected indicators
              </p>

              {getEvidenceList(selectedScan.evidence).length > 0 ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                  {getEvidenceList(selectedScan.evidence).map(
                    (item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    )
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No structured indicators were saved for this scan.
                </p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Recommended actions
              </p>

              {getEvidenceList(selectedScan.recommendations).length > 0 ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                  {getEvidenceList(selectedScan.recommendations).map(
                    (item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    )
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No recommendations were saved for this scan.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete(selectedScan.id)}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Scan"}
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => setSelectedScan(null)}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close Details
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
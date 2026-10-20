"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Scan = {
  id: string;
  type: string;
  status?: string;
  inputSummary?: string | null;
  content?: string | null;
  input?: string | null;
  trustScore?: number | null;
  scamProbability?: number | null;
  threatCategory?: string | null;
  explanation?: string | null;
  createdAt?: string;
};

type HistoryResponse = {
  success: boolean;
  message?: string;
  data?: Scan[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function HistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const token = localStorage.getItem("trustlens_token");

      if (!token) {
        setError("Please log in to view your scan history.");
        setScans([]);
        return;
      }

      const response = await fetch(
        `${API_URL}/api/history?page=1&limit=50`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const result: HistoryResponse = await response.json();

      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Session expired. Please log in again.");
        }

        throw new Error(
          result.message || "Unable to retrieve scan history.",
        );
      }

      const records = Array.isArray(result.data) ? result.data : [];

      setScans(records);
      setTotalRecords(result.pagination?.total ?? records.length);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading history.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function deleteScan(scanId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this scan history entry?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(scanId);
    setError("");
    setSuccessMessage("");

    try {
      const token = localStorage.getItem("trustlens_token");

      if (!token) {
        throw new Error("Please log in again.");
      }

      const response = await fetch(
        `${API_URL}/api/history/${encodeURIComponent(scanId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Session expired. Please log in again.");
        }

        throw new Error(
          result.message || "Failed to delete scan history.",
        );
      }

      // Remove the deleted scan from the current page.
      setScans((currentScans) =>
        currentScans.filter((scan) => scan.id !== scanId),
      );

      setTotalRecords((currentTotal) => Math.max(0, currentTotal - 1));

      setSuccessMessage("Scan history deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete scan history.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function getScanContent(scan: Scan): string {
    return (
      scan.content?.trim() ||
      scan.input?.trim() ||
      scan.inputSummary?.trim() ||
      "No scan content available"
    );
  }

  function getTrustScore(scan: Scan): number | null {
    return typeof scan.trustScore === "number"
      ? scan.trustScore
      : null;
  }

  function getScamProbability(scan: Scan): number | null {
    return typeof scan.scamProbability === "number"
      ? scan.scamProbability
      : null;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-sm font-bold tracking-wide text-cyan-400">
              TRUSTLENS AI
            </p>

            <h1 className="text-3xl font-bold sm:text-4xl">
              Scan History
            </h1>

            <p className="mt-2 text-slate-400">
              View and manage your previous scans.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-5 py-3 font-medium transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300"
          >
            {error}
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-green-300"
          >
            {successMessage}
          </div>
        )}

        {/* History card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Previous Scans</h2>

            <span className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-300">
              {totalRecords} records
            </span>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-slate-400">
                Loading scan history...
              </p>
            </div>
          ) : scans.length === 0 ? (
            /* Empty state */
            <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
              <h3 className="text-lg font-semibold">
                No scan history found
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Your previous scans will appear here.
              </p>

              <Link
                href="/dashboard"
                className="mt-5 inline-block rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            /* Scan records */
            <div className="space-y-4">
              {scans.map((scan) => {
                const trustScore = getTrustScore(scan);
                const scamProbability = getScamProbability(scan);

                return (
                  <article
                    key={scan.id}
                    className="flex flex-col gap-5 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    {/* Scan details */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300">
                          {scan.type}
                        </span>

                        {scan.status && (
                          <span className="text-sm text-slate-400">
                            {scan.status}
                          </span>
                        )}
                      </div>

                      {/* Actual stored summary */}
                      <p className="break-words text-sm leading-6 text-slate-200">
                        {getScanContent(scan)}
                      </p>

                      {scan.threatCategory && (
                        <p className="mt-2 text-sm text-slate-400">
                          Threat Category: {scan.threatCategory}
                        </p>
                      )}

                      {/* Scores */}
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                        {trustScore !== null && (
                          <span className="text-slate-300">
                            Trust Score:{" "}
                            <strong className="text-cyan-300">
                              {trustScore}/100
                            </strong>
                          </span>
                        )}

                        {scamProbability !== null && (
                          <span className="text-slate-300">
                            Scam Probability:{" "}
                            <strong
                              className={
                                scamProbability >= 60
                                  ? "text-red-400"
                                  : scamProbability >= 20
                                    ? "text-amber-300"
                                    : "text-green-400"
                              }
                            >
                              {scamProbability}%
                            </strong>
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      {scan.createdAt && (
                        <p className="mt-3 text-xs text-slate-500">
                          {new Date(scan.createdAt).toLocaleString()}
                        </p>
                      )}

                      {/* Scan ID */}
                      <p className="mt-2 break-all text-xs text-slate-600">
                        ID: {scan.id}
                      </p>
                    </div>

                    {/* Delete button */}
                    <div className="flex shrink-0 sm:justify-center">
                      <button
                        type="button"
                        onClick={() => void deleteScan(scan.id)}
                        disabled={deletingId === scan.id}
                        className="rounded-lg border border-red-500/40 px-5 py-3 font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === scan.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Note: History displays the scan summary stored by the backend.
          Deleting a history entry permanently removes that scan record.
          Trust scores and scam probabilities are heuristic estimates,
          not guarantees of safety.
        </p>
      </div>
    </main>
  );
}
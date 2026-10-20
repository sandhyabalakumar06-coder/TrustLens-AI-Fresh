"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardLink() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(localStorage.getItem("trustlens_token")));
  }, []);

  if (!loggedIn) {
    return null;
  }

  return (
    <Link
      href="/dashboard"
      className="rounded-lg border border-cyan-400/30 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/10"
    >
      Dashboard →
    </Link>
  );
}
"use client";

import { AppShell } from "@/components/AppShell";
import { useProtectedRoute } from "@/lib/authService";
import React from "react";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useProtectedRoute();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0a0a0a",
          color: "#36d6b6",
          fontSize: "16px",
        }}
      >
        Loading...
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

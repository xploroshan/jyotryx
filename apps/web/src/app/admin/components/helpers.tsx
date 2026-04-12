"use client";

import React from "react";

export function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "purple" | "blue" }) {
  const colors = {
    default: "bg-white/[0.03] text-white/40",
    success: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/20 text-amber-400",
    danger: "bg-red-500/20 text-red-400",
    purple: "bg-purple-500/20 text-purple-400",
    blue: "bg-blue-500/20 text-blue-400",
  };
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[variant]}`}>{children}</span>;
}

export function roleBadge(role: string) {
  if (role === "ADMIN") return <Badge variant="danger">{role}</Badge>;
  if (role === "PREMIUM") return <Badge variant="purple">{role}</Badge>;
  return <Badge>{role}</Badge>;
}

export function statusBadge(status: string) {
  if (status === "ACTIVE" || status === "SUCCESS" || status === "READY") return <Badge variant="success">{status}</Badge>;
  if (status === "PENDING" || status === "GENERATING") return <Badge variant="warning">{status}</Badge>;
  if (status === "CANCELLED" || status === "FAILED" || status === "EXPIRED") return <Badge variant="danger">{status}</Badge>;
  return <Badge>{status}</Badge>;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

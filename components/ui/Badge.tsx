"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  warning: "bg-[var(--warning-soft)] text-[#B45309]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "bg-[var(--info-soft)] text-[#0369A1]",
};

export function Badge({ tone = "neutral", icon, children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-[5px]",
        "px-[9px] py-[3px] rounded-[12px]",
        "text-[11px] font-semibold whitespace-nowrap leading-[1.4]",
        toneClass[tone],
        className,
      ].join(" ")}
    >
      {icon ? <Icon name={icon} size={11} /> : null}
      {children}
    </span>
  );
}

export type OrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "received"
  | "dispute"
  | "cancelled";

const statusStyle: Record<
  OrderStatus,
  { tone: BadgeTone; label: string; extra?: string }
> = {
  draft: { tone: "neutral", label: "Brouillon" },
  sent: { tone: "info", label: "Envoyée" },
  confirmed: { tone: "accent", label: "Confirmée" },
  preparing: { tone: "warning", label: "En préparation" },
  shipped: { tone: "warning", label: "Expédiée" },
  delivered: { tone: "info", label: "Livrée", extra: "bg-[#DBEAFE] text-[#1E40AF]" },
  received: { tone: "success", label: "Réceptionnée" },
  dispute: { tone: "danger", label: "Litige" },
  cancelled: { tone: "neutral", label: "Annulée", extra: "line-through text-[var(--text-subtle)]" },
};

export function StatusPill({ status, label, className = "" }: { status: OrderStatus; label?: string; className?: string }) {
  const s = statusStyle[status];
  const classes = s.extra ? s.extra : toneClass[s.tone];
  return (
    <span
      className={[
        "inline-flex items-center gap-[5px]",
        "px-[9px] py-[3px] rounded-[12px]",
        "text-[11px] font-semibold whitespace-nowrap leading-[1.4]",
        classes,
        className,
      ].join(" ")}
    >
      <Dot />
      {label || s.label}
    </span>
  );
}

export function Dot({ pulse = false, className = "" }: { pulse?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-block w-[5px] h-[5px] rounded-full bg-current",
        pulse ? "animate-pulse-dot" : "",
        className,
      ].join(" ")}
    />
  );
}

export interface PermissionChipProps {
  kind?: "regular" | "admin" | "custom";
  children: ReactNode;
  className?: string;
}

export function PermissionChip({ kind = "regular", children, className = "" }: PermissionChipProps) {
  const palette =
    kind === "admin"
      ? "bg-[var(--accent-soft)] text-[var(--accent)] font-[650]"
      : kind === "custom"
        ? "bg-[var(--accent-soft)] text-[var(--accent)] font-[650] uppercase tracking-[0.04em]"
        : "bg-[var(--bg-subtle)] text-[var(--text-muted)]";
  return (
    <span
      className={[
        "inline-flex items-center gap-[5px] px-[8px] py-[2px] rounded-[10px]",
        "text-[10.5px] font-semibold",
        palette,
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

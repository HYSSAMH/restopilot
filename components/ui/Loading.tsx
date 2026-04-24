"use client";

import type { HTMLAttributes } from "react";

export interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 14, className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={`inline-block rounded-full animate-spin ${className}`}
      style={{
        width: size,
        height: size,
        border: "2px solid var(--bg-subtle)",
        borderTopColor: "var(--accent)",
      }}
    />
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  rounded?: boolean | number;
}

export function Skeleton({ width, height = 12, rounded = true, className = "", style, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width,
        height,
        borderRadius: typeof rounded === "number" ? rounded : rounded ? 4 : 0,
        background:
          "linear-gradient(90deg, var(--bg-subtle) 0%, #EEEEEE 50%, var(--bg-subtle) 100%)",
        backgroundSize: "200% 100%",
        animation: "rp-shimmer 1.4s linear infinite",
        ...style,
      }}
      {...rest}
    />
  );
}

export interface ProgressProps {
  value: number; // 0-100
  tone?: "accent" | "good" | "ok" | "low";
  className?: string;
  label?: string;
}

const progressFill: Record<NonNullable<ProgressProps["tone"]>, string> = {
  accent: "bg-[var(--accent)]",
  good: "bg-[var(--success)]",
  ok: "bg-[var(--warning)]",
  low: "bg-[var(--danger)]",
};

export function Progress({ value, tone = "accent", className = "", label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-[6px] rounded-[3px] bg-[var(--bg-subtle)] overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-[3px] ${progressFill[tone]}`}
        style={{ width: `${clamped}%`, transition: "width 300ms var(--ease-out)" }}
      />
    </div>
  );
}

"use client";

import type { ReactNode, HTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <div
      className={[
        "bg-white border border-[var(--border)] rounded-[10px]",
        "overflow-hidden",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  actions,
  className = "",
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-center gap-[10px] px-4 py-[14px]",
        "border-b border-[var(--border)]",
        className,
      ].join(" ")}
    >
      <div className="flex-1 min-w-0">
        {title ? <div className="text-[14px] font-semibold tracking-[-0.01em]">{title}</div> : null}
        {sub ? <div className="text-[12.5px] text-[var(--text-muted)]">{sub}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: { value: string; trend: "up" | "down" | "flat" };
  sparkline?: ReactNode;
  icon?: IconName;
  className?: string;
}

export function KpiCard({ label, value, unit, delta, sparkline, icon, className = "" }: KpiCardProps) {
  return (
    <div className={`kpi-card ${className}`}>
      <div className="kpi-label">
        {icon ? <Icon name={icon} size={13} /> : null}
        <span className="label-upper" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="kpi-value">
          {value}
          {unit ? <span className="unit">{unit}</span> : null}
        </div>
        {sparkline ? <div className="flex-shrink-0">{sparkline}</div> : null}
      </div>
      {delta ? (
        <div className="mt-[6px]">
          <span className={`kpi-delta ${delta.trend}`}>
            {delta.trend === "up" ? <Icon name="trending-up" size={11} /> : null}
            {delta.trend === "down" ? <Icon name="trending-down" size={11} /> : null}
            {delta.value}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, sub, className = "" }: StatCardProps) {
  return (
    <div
      className={[
        "bg-white border border-[var(--border)] rounded-[10px]",
        "px-4 py-3",
        className,
      ].join(" ")}
    >
      <div className="label-upper mb-1">{label}</div>
      <div className="mono text-[22px] font-[700] text-[var(--text)] leading-none">{value}</div>
      {sub ? <div className="text-[11px] text-[var(--text-muted)] mt-[2px]">{sub}</div> : null}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: IconName;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon = "inbox", title, sub, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-[60px] px-5 ${className}`}>
      <div className="text-[var(--text-muted)] opacity-50 mb-3">
        <Icon name={icon} size={32} />
      </div>
      <div className="text-[14px] font-semibold text-[var(--text)]">{title}</div>
      {sub ? <div className="text-[12px] text-[var(--text-subtle)] mt-1 max-w-[320px]">{sub}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

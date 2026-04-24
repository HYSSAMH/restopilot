"use client";

import type { CSSProperties, ReactNode, HTMLAttributes } from "react";
import { Icon } from "./Icon";

/**
 * Grid-based table primitives. Pass gridTemplateColumns via the columns prop
 * so header + rows share the same track structure.
 */

export interface TableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Table({ className = "", children, ...rest }: TableProps) {
  return (
    <div
      role="table"
      className={[
        "bg-white border border-[var(--border)] rounded-[10px] overflow-hidden",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface TableHeadProps extends HTMLAttributes<HTMLDivElement> {
  columns: string;
  children: ReactNode;
}

export function TableHead({ columns, className = "", children, ...rest }: TableHeadProps) {
  return (
    <div
      role="row"
      className={[
        "grid items-center gap-[14px] px-4 py-3",
        "bg-[var(--bg-subtle)] border-b border-[var(--border)]",
        "text-[10.5px] font-[650] text-[var(--text-muted)] uppercase tracking-[0.04em]",
        className,
      ].join(" ")}
      style={{ gridTemplateColumns: columns }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLDivElement> {
  columns: string;
  active?: boolean;
  clickable?: boolean;
  children: ReactNode;
}

export function TableRow({
  columns,
  active,
  clickable = false,
  className = "",
  children,
  style,
  ...rest
}: TableRowProps) {
  const mergedStyle: CSSProperties = { gridTemplateColumns: columns, ...style };
  return (
    <div
      role="row"
      className={[
        "grid items-center gap-[14px] px-4 py-[14px]",
        "border-b border-[var(--border)] last:border-b-0",
        "transition-colors duration-[120ms]",
        clickable ? "cursor-pointer" : "",
        active
          ? "bg-[var(--accent-soft)]"
          : clickable
            ? "hover:bg-[var(--bg-subtle)]"
            : "",
        className,
      ].join(" ")}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface SortState {
  key: string | null;
  direction: "asc" | "desc" | null;
}

export function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (s: SortState) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const nextDirection = !active ? "asc" : sort.direction === "asc" ? "desc" : null;
  const iconName = !active
    ? "chevrons-up-down"
    : sort.direction === "asc"
      ? "chevron-up"
      : "chevron-down";
  return (
    <button
      type="button"
      onClick={() =>
        onSort(
          nextDirection ? { key: sortKey, direction: nextDirection } : { key: null, direction: null },
        )
      }
      className={[
        "inline-flex items-center gap-1 text-left uppercase tracking-[0.04em]",
        "text-[10.5px] font-[650]",
        active ? "text-[var(--text)]" : "text-[var(--text-muted)]",
        "hover:text-[var(--text)]",
        className,
      ].join(" ")}
    >
      {label}
      <Icon name={iconName} size={10} />
    </button>
  );
}

export function TableFooter({
  left,
  right,
  className = "",
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between",
        "px-4 h-11 bg-[var(--bg-subtle)]",
        "text-[12px] text-[var(--text-muted)] mono",
        className,
      ].join(" ")}
    >
      <div>{left}</div>
      <div className="flex items-center gap-1">{right}</div>
    </div>
  );
}

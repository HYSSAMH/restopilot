"use client";

import type { ReactNode } from "react";

export interface TabItem<Id extends string = string> {
  id: Id;
  label: ReactNode;
  count?: number;
}

export interface TabsProps<Id extends string = string> {
  items: TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  className?: string;
}

export function Tabs<Id extends string = string>({ items, value, onChange, className = "" }: TabsProps<Id>) {
  return (
    <div
      role="tablist"
      className={[
        "inline-flex gap-[2px] p-1 bg-[var(--bg-subtle)] rounded-[9px] w-fit",
        className,
      ].join(" ")}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={[
              "inline-flex items-center gap-[6px]",
              "px-[14px] py-[7px] rounded-[6px]",
              "text-[12.5px] font-semibold",
              "transition-[background,color,box-shadow] duration-[120ms]",
              active
                ? "bg-white text-[var(--text)] shadow-[var(--elev-1)]"
                : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={[
                  "mono tabular inline-flex items-center justify-center",
                  "px-[7px] py-[1px] rounded-[10px] text-[10.5px] font-medium",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
                ].join(" ")}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

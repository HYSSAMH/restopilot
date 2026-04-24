"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

type BannerTone = "danger" | "warning" | "info" | "success" | "muted";

const bannerClass: Record<BannerTone, string> = {
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "bg-[var(--warning-soft)] text-[#B45309]",
  info: "bg-[var(--info-soft)] text-[#0369A1]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  muted: "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
};

const bannerIcon: Record<BannerTone, IconName> = {
  danger: "alert-triangle",
  warning: "alert-triangle",
  info: "info",
  success: "check-circle",
  muted: "info",
};

export interface BannerProps {
  tone?: BannerTone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

export function Banner({ tone = "info", icon, children, className = "" }: BannerProps) {
  return (
    <div
      role="status"
      className={[
        "flex items-start gap-[10px] px-3 py-[10px] rounded-[8px]",
        "text-[12.5px] font-[550]",
        bannerClass[tone],
        className,
      ].join(" ")}
    >
      <Icon name={icon || bannerIcon[tone]} size={14} className="flex-shrink-0 mt-[1px]" />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

export function Tooltip({ label, children, side = "top", className = "" }: TooltipProps) {
  const position =
    side === "top"
      ? "bottom-full mb-1 left-1/2 -translate-x-1/2"
      : "top-full mt-1 left-1/2 -translate-x-1/2";
  return (
    <span className={`relative inline-flex group ${className}`}>
      {children}
      <span
        role="tooltip"
        className={[
          "absolute opacity-0 group-hover:opacity-100 pointer-events-none",
          "transition-opacity duration-[120ms]",
          "bg-[#1F2937] text-white text-[11.5px] rounded-[6px] px-[10px] py-[5px]",
          "shadow-[var(--elev-3)] whitespace-nowrap",
          position,
        ].join(" ")}
        style={{ zIndex: 120 }}
      >
        {label}
      </span>
    </span>
  );
}

// ───────────────────────────────────────────────────────────────
// Toast system (lightweight, client-side only)
// ───────────────────────────────────────────────────────────────

type ToastTone = "default" | "success" | "warning" | "danger";
interface ToastEntry {
  id: number;
  message: ReactNode;
  tone: ToastTone;
  duration: number;
}

type ToastListener = (items: ToastEntry[]) => void;

const toastState: { items: ToastEntry[]; listeners: ToastListener[]; seq: number } = {
  items: [],
  listeners: [],
  seq: 1,
};

function notify() {
  for (const l of toastState.listeners) l(toastState.items);
}

export function pushToast(message: ReactNode, options?: { tone?: ToastTone; duration?: number }) {
  const id = toastState.seq++;
  const tone = options?.tone ?? "default";
  const duration = options?.duration ?? 4000;
  toastState.items = [...toastState.items, { id, message, tone, duration }];
  notify();
  if (duration > 0) {
    window.setTimeout(() => {
      toastState.items = toastState.items.filter((t) => t.id !== id);
      notify();
    }, duration);
  }
  return id;
}

export function dismissToast(id: number) {
  toastState.items = toastState.items.filter((t) => t.id !== id);
  notify();
}

const toneStyle: Record<ToastTone, string> = {
  default: "bg-[#1F2937] text-white",
  success: "bg-[var(--success)] text-white",
  warning: "bg-[var(--warning)] text-white",
  danger: "bg-[var(--danger)] text-white",
};

export function Toaster() {
  const [items, setItems] = useState<ToastEntry[]>(toastState.items);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const listener: ToastListener = (next) => setItems([...next]);
    toastState.listeners.push(listener);
    return () => {
      toastState.listeners = toastState.listeners.filter((l) => l !== listener);
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: 110 }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={[
            "pointer-events-auto min-w-[240px] max-w-[420px]",
            "rounded-[10px] px-4 py-3 shadow-[var(--elev-4)]",
            "text-[13px] font-medium",
            "animate-[rp-slide-up_280ms_var(--ease-out)_both]",
            toneStyle[t.tone],
          ].join(" ")}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}

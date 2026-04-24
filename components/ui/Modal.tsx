"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { IconButton } from "./Button";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const sizeWidth: Record<ModalSize, string> = {
  sm: "420px",
  md: "520px",
  lg: "720px",
  xl: "960px",
  full: "1320px",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
}

export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  ariaLabel,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-[rgba(15,15,20,0.4)] animate-fade-in"
        style={{ zIndex: 90 }}
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] flex flex-col animate-fade-in shadow-[var(--elev-5)]"
        style={{
          width: sizeWidth[size],
          maxWidth: "94vw",
          maxHeight: "90vh",
          zIndex: 100,
        }}
      >
        {title ? (
          <div className="flex items-start justify-between gap-3 px-5 py-[18px] border-b border-[var(--border)]">
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-[650] tracking-[-0.01em] text-[var(--text)]">{title}</div>
              {sub ? <div className="text-[12.5px] text-[var(--text-muted)] mt-[2px]">{sub}</div> : null}
            </div>
            <IconButton name="x" label="Fermer" onClick={onClose} />
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-5 py-[18px]">{children}</div>
        {footer ? (
          <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  width?: number;
  ariaLabel?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  sub,
  children,
  actions,
  width = 520,
  ariaLabel,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-[rgba(15,15,20,0.4)] animate-fade-in"
        style={{ zIndex: 90 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        className="fixed top-0 right-0 bottom-0 bg-[var(--bg)] flex flex-col animate-drawer-in shadow-[-24px_0_48px_-16px_rgba(0,0,0,0.18)]"
        style={{ width, maxWidth: "100vw", zIndex: 100 }}
      >
        {title ? (
          <div className="flex items-center gap-3 px-[18px] py-4 border-b border-[var(--border)] bg-white">
            <IconButton name="arrow-left" label="Retour" onClick={onClose} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-[650] tracking-[-0.01em] text-[var(--text)] truncate">{title}</div>
              {sub ? <div className="text-[12px] text-[var(--text-muted)] truncate">{sub}</div> : null}
            </div>
            <IconButton name="x" label="Fermer" onClick={onClose} />
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto p-[18px]">{children}</div>
        {actions ? (
          <div className="px-[18px] py-3 border-t border-[var(--border)] bg-white flex flex-col gap-[6px]">
            {actions}
          </div>
        ) : null}
      </aside>
    </>,
    document.body,
  );
}

export interface PopoverProps {
  open: boolean;
  onClose?: () => void;
  anchor?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
  className?: string;
}

export function Popover({ open, children, className = "" }: PopoverProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      className={[
        "absolute z-[20] bg-white border border-[var(--border)] rounded-[8px]",
        "shadow-[var(--elev-3)] p-2",
        "animate-fade-in",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

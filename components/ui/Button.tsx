"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white border border-[var(--accent)] shadow-[0_1px_2px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)]",
  secondary:
    "bg-white text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:border-[#B6B6BC]",
  ghost:
    "bg-transparent text-[var(--text-muted)] border border-transparent hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
  danger:
    "bg-white text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--danger-soft)]",
};

const sizeClass: Record<Size, string> = {
  sm: "h-7 px-2 text-[12px] gap-[5px] rounded-[6px]",
  md: "px-3 py-[7px] text-[13px] gap-[7px] rounded-[8px]",
  lg: "h-10 px-5 text-[14px] gap-2 rounded-[8px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    iconLeft,
    iconRight,
    children,
    className = "",
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center whitespace-nowrap font-[550] leading-none",
        "transition-[background,border-color,color,box-shadow] duration-[120ms]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:translate-y-px",
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <Spinner size={iconSize} />
      ) : iconLeft ? (
        <Icon name={iconLeft} size={iconSize} />
      ) : null}
      {children}
      {!loading && iconRight ? <Icon name={iconRight} size={iconSize} /> : null}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  name: IconName;
  size?: number;
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ name, size = 14, label, className = "", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={[
          "inline-flex items-center justify-center",
          "w-7 h-7 rounded-[6px]",
          "bg-transparent text-[var(--text-muted)]",
          "hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
          "transition-colors duration-[120ms]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ].join(" ")}
        {...rest}
      >
        <Icon name={name} size={size} />
      </button>
    );
  },
);

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full animate-spin"
      style={{
        width: size,
        height: size,
        border: "2px solid var(--bg-subtle)",
        borderTopColor: "currentColor",
      }}
      aria-hidden="true"
    />
  );
}

"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { forwardRef } from "react";

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "onClick"> {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
  label?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onChange, size = "md", label, disabled, className = "", ...rest },
  ref,
) {
  const isSm = size === "sm";
  const width = isSm ? 34 : 40;
  const height = isSm ? 18 : 22;
  const dot = isSm ? 13 : 16;
  const pad = isSm ? 2.5 : 3;
  const dotLeft = checked ? width - dot - pad : pad;
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "relative border-0 cursor-pointer p-0 rounded-full",
        "transition-colors duration-[200ms]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      style={{
        width,
        height,
        background: checked ? "var(--accent)" : "var(--border)",
      }}
      {...rest}
    >
      <span
        className="absolute rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] duration-[200ms]"
        style={{
          width: dot,
          height: dot,
          top: pad,
          left: dotLeft,
          transitionTimingFunction: "var(--ease-spring)",
        }}
      />
    </button>
  );
});

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className = "", id, ...rest },
  ref,
) {
  const content = (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className={[
        "w-[15px] h-[15px] cursor-pointer",
        "accent-[var(--accent)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      {...rest}
    />
  );
  if (!label) return content;
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer text-[13px] text-[var(--text)]">
      {content}
      <span>{label}</span>
    </label>
  );
});

export interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, className = "", id, ...rest },
  ref,
) {
  const content = (
    <input
      ref={ref}
      id={id}
      type="radio"
      className={[
        "w-[15px] h-[15px] cursor-pointer accent-[var(--accent)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      {...rest}
    />
  );
  if (!label) return content;
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer text-[13px] text-[var(--text)]">
      {content}
      <span>{label}</span>
    </label>
  );
});

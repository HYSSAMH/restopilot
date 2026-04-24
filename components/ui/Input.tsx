"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { Icon } from "./Icon";

const baseField =
  "w-full bg-white border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text)] " +
  "px-3 outline-none transition-[border-color,box-shadow,background] duration-[120ms] " +
  "placeholder:text-[var(--text-subtle)] " +
  "focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] " +
  "disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-[var(--danger)] aria-[invalid=true]:shadow-[0_0_0_3px_var(--danger-soft)]";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${baseField} h-9 ${className}`}
      {...rest}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = "", invalid, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`${baseField} py-[10px] resize-y min-h-[80px] ${className}`}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", invalid, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`${baseField} h-9 pr-8 appearance-none cursor-pointer ${className}`}
        {...rest}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
        <Icon name="chevron-down" size={14} />
      </div>
    </div>
  );
});

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
}

export function SearchInput({
  value,
  onValueChange,
  placeholder = "Rechercher…",
  clearable = true,
  className = "",
  ...rest
}: SearchInputProps) {
  return (
    <label
      className={[
        "inline-flex items-center gap-2 h-9 px-3",
        "bg-[var(--bg-subtle)] border border-transparent rounded-[7px]",
        "transition-all duration-[120ms]",
        "focus-within:bg-white focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
        className,
      ].join(" ")}
    >
      <Icon name="search" size={14} className="text-[var(--text-muted)] flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-subtle)]"
        {...rest}
      />
      {clearable && value ? (
        <button
          type="button"
          aria-label="Effacer"
          onClick={() => onValueChange("")}
          className="text-[var(--text-muted)] hover:text-[var(--text)] flex-shrink-0"
        >
          <Icon name="x" size={14} />
        </button>
      ) : null}
    </label>
  );
}

export function Label({ children, htmlFor, className = "" }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-[11.5px] font-semibold text-[var(--text)] ${className}`}
    >
      {children}
    </label>
  );
}

export function Hint({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] text-[var(--text-muted)] mt-[2px] ${className}`}>{children}</p>
  );
}

export function FieldError({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] text-[var(--danger)] mt-[2px] inline-flex items-center gap-1 ${className}`}>
      <Icon name="alert-circle" size={11} />
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      {label ? (
        <Label>
          {label}
          {required ? <span className="text-[var(--danger)] ml-0.5">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

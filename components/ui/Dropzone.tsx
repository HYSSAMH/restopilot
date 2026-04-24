"use client";

import { useCallback, useRef, useState, type ReactNode, type DragEvent } from "react";
import { Icon, type IconName } from "./Icon";

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  icon?: IconName;
  title?: ReactNode;
  sub?: ReactNode;
  cta?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Dropzone({
  onFiles,
  accept,
  multiple = false,
  icon = "upload-cloud",
  title = "Déposez votre fichier ici",
  sub = "ou cliquez pour parcourir",
  cta,
  disabled,
  className = "",
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    },
    [disabled, multiple, onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      aria-disabled={disabled || undefined}
      className={[
        "relative flex flex-col items-center justify-center text-center",
        "px-5 py-10 rounded-[12px] border-2 border-dashed cursor-pointer",
        "transition-[border-color,background,transform] duration-[200ms]",
        dragOver
          ? "border-[var(--accent)] bg-[var(--accent-soft)] scale-[1.01]"
          : "border-[var(--border)] bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        className,
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(multiple ? files : files.slice(0, 1));
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <div className="text-[var(--text-muted)] mb-3">
        <Icon name={icon} size={48} strokeWidth={1.5} />
      </div>
      <div className="text-[15px] font-semibold text-[var(--text)]">{title}</div>
      {sub ? <div className="text-[12px] text-[var(--text-muted)] mt-1">{sub}</div> : null}
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  );
}

export type IaStepState = "pending" | "active" | "done" | "error";

export interface IaStep {
  id: string;
  label: ReactNode;
  state: IaStepState;
}

export function ImportStepper({ steps, className = "" }: { steps: IaStep[]; className?: string }) {
  return (
    <ol className={`flex flex-col gap-[10px] ${className}`}>
      {steps.map((step) => {
        const base = "flex items-center gap-3 px-3 py-[10px] rounded-[8px] border";
        const palette =
          step.state === "done"
            ? "bg-[var(--success-soft)] border-[color:var(--success-soft)] text-[var(--success)]"
            : step.state === "active"
              ? "bg-[var(--accent-soft)] border-[color:var(--accent-soft)] text-[var(--accent)]"
              : step.state === "error"
                ? "bg-[var(--danger-soft)] border-[color:var(--danger-soft)] text-[var(--danger)]"
                : "bg-[var(--bg-subtle)] border-transparent text-[var(--text-muted)]";
        return (
          <li key={step.id} className={`${base} ${palette}`}>
            <span className="flex-shrink-0">
              {step.state === "done" ? (
                <Icon name="check-circle" size={20} />
              ) : step.state === "active" ? (
                <span
                  className="inline-block rounded-full animate-spin"
                  style={{
                    width: 18,
                    height: 18,
                    border: "2px solid var(--accent-soft)",
                    borderTopColor: "var(--accent)",
                  }}
                  aria-hidden="true"
                />
              ) : step.state === "error" ? (
                <Icon name="alert-circle" size={20} />
              ) : (
                <span className="inline-block w-[18px] h-[18px] rounded-full border-2 border-[var(--border-strong)]" aria-hidden="true" />
              )}
            </span>
            <span className="flex-1 text-[13px] font-[550]">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

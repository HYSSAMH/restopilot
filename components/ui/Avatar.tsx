"use client";

type AvatarSize = "sm" | "md" | "lg";

const sizeMap: Record<AvatarSize, { px: number; radius: number; font: number }> = {
  sm: { px: 30, radius: 6, font: 11 },
  md: { px: 42, radius: 8, font: 14 },
  lg: { px: 68, radius: 14, font: 22 },
};

export interface AvatarProps {
  name?: string;
  initials?: string;
  imageUrl?: string;
  color?: string;
  gradient?: boolean;
  size?: AvatarSize;
  className?: string;
}

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({
  name,
  initials,
  imageUrl,
  color,
  gradient = false,
  size = "md",
  className = "",
}: AvatarProps) {
  const dims = sizeMap[size];
  const label = initials ?? getInitials(name);
  const background = gradient
    ? "linear-gradient(135deg, #6366F1, #8B5CF6)"
    : color || "#1E293B";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || ""}
        style={{ width: dims.px, height: dims.px, borderRadius: dims.radius }}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={`inline-flex items-center justify-center text-white font-[650] mono tracking-[-0.02em] ${className}`}
      style={{
        width: dims.px,
        height: dims.px,
        borderRadius: dims.radius,
        background,
        fontSize: dims.font,
      }}
    >
      {label}
    </span>
  );
}

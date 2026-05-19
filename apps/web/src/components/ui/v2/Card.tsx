import type { HTMLAttributes, ReactNode } from "react";

type Tone = "default" | "subtle" | "accent";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  padding?: "none" | "sm" | "md" | "lg";
  asChild?: boolean;
}

const toneClass: Record<Tone, string> = {
  default: "v2-surface",
  subtle: "v2-surface-subtle",
  accent: "v2-surface border-l-2 border-l-[var(--color-accent)]",
};

const padClass = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  tone = "default",
  padding = "md",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div className={`${toneClass[tone]} ${padClass[padding]} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-[15px] font-semibold text-[var(--color-fg)] ${className}`}>{children}</h3>;
}

export function CardCaption({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-medium ${className}`}>{children}</p>;
}

export function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] text-[var(--color-fg-muted)] leading-relaxed ${className}`}>{children}</p>;
}

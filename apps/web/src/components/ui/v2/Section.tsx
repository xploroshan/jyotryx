import type { HTMLAttributes, ReactNode } from "react";

type Spacing = "sm" | "md" | "lg" | "xl";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  spacing?: Spacing;
  divided?: boolean;
}

const spaceClass: Record<Spacing, string> = {
  sm: "py-10",
  md: "py-16",
  lg: "py-24",
  xl: "py-32",
};

export function Section({ spacing = "md", divided = false, className = "", children, ...rest }: SectionProps) {
  return (
    <section
      className={`${spaceClass[spacing]} ${divided ? "border-t border-[var(--color-border)]" : ""} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={`mb-10 ${align === "center" ? "text-center mx-auto max-w-2xl" : "max-w-2xl"}`}>
      {eyebrow && (
        <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="text-[28px] sm:text-[32px] leading-[1.15] font-semibold text-[var(--color-fg)] tracking-[-0.01em]">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-[15px] text-[var(--color-fg-muted)] leading-relaxed">{description}</p>
      )}
    </div>
  );
}

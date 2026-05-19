import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-[14px]",
  lg: "h-11 px-5 text-[15px]",
};

const variantClass: Record<Variant, string> = {
  primary: "v2-btn-primary",
  secondary: "v2-btn-secondary",
  ghost: "v2-btn-ghost",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", iconLeft, iconRight, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`v2-btn ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});

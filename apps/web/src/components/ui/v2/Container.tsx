import type { HTMLAttributes } from "react";

type Width = "sm" | "md" | "lg" | "xl" | "full";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: Width;
}

const widthClass: Record<Width, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

export function Container({ width = "lg", className = "", children, ...rest }: ContainerProps) {
  return (
    <div className={`mx-auto w-full px-5 sm:px-6 lg:px-8 ${widthClass[width]} ${className}`} {...rest}>
      {children}
    </div>
  );
}

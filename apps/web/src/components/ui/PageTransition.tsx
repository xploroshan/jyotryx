'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode, HTMLAttributes } from 'react';
import { pageVariants, reducedVariants, staggerContainer, itemVariants } from '@/lib/motion';

/**
 * Wraps a page body in a fade+lift entrance. Use once per route as the
 * top-level element inside the page component. Child `<Stagger.Item>`
 * elements will cascade in after the parent finishes.
 */
export function PageTransition({
  children,
  className,
  as: _as,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Defaults to 'div'. Use 'section' / 'main' if the page needs semantics. */
  as?: 'div' | 'section' | 'main';
} & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>) {
  const reduce = useReducedMotion();
  const Component = (motion as any)[_as ?? 'div'];
  return (
    <Component
      className={className}
      initial="hidden"
      animate="visible"
      variants={reduce ? reducedVariants : pageVariants}
      {...rest}
    >
      {children}
    </Component>
  );
}

/**
 * Stagger.Container + Stagger.Item compound component for cascaded reveals.
 * Use for card grids, feature lists, form fields — anywhere a group of
 * sibling elements benefits from a ripple-in.
 */
function StaggerContainer({
  children,
  className,
  as: _as,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol' | 'section';
}) {
  const reduce = useReducedMotion();
  const Component = (motion as any)[_as ?? 'div'];
  return (
    <Component
      className={className}
      initial="hidden"
      animate="visible"
      variants={reduce ? reducedVariants : staggerContainer}
    >
      {children}
    </Component>
  );
}

function StaggerItem({
  children,
  className,
  as: _as,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'section' | 'article';
}) {
  const reduce = useReducedMotion();
  const Component = (motion as any)[_as ?? 'div'];
  return (
    <Component className={className} variants={reduce ? reducedVariants : itemVariants}>
      {children}
    </Component>
  );
}

export const Stagger = { Container: StaggerContainer, Item: StaggerItem };

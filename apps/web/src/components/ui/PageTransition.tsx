import type { ReactNode, HTMLAttributes } from 'react';

/**
 * Entrance + stagger primitives.
 *
 * These used framer-motion, which put the whole animation library (~45 KB gzip)
 * into the First Load of every page that revealed content this way (home,
 * pricing, …). The visual intent — a fade+lift entrance, with grouped children
 * cascading in — is fully expressible in CSS, so these now render plain elements
 * carrying `.page-enter` / `.stagger-item` classes (see globals.css). The
 * cascade comes from `:nth-child` animation-delays; reduced-motion is honoured
 * there too. The public API is unchanged, so consumers need no edits.
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
  const Component = (_as ?? 'div') as 'div';
  return (
    <Component className={`page-enter${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Component>
  );
}

function StaggerContainer({
  children,
  className,
  as: _as,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol' | 'section';
}) {
  const Component = (_as ?? 'div') as 'div';
  return <Component className={className}>{children}</Component>;
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
  const Component = (_as ?? 'div') as 'div';
  return (
    <Component className={`stagger-item${className ? ` ${className}` : ''}`}>{children}</Component>
  );
}

export const Stagger = { Container: StaggerContainer, Item: StaggerItem };

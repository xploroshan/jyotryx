/**
 * A visually prominent required-field asterisk. Accessible label conveys
 * "required" for screen readers without relying on color alone.
 *
 * Lives in its own module (not Toast.tsx) on purpose: Toast imports
 * framer-motion, and form pages like /kundli and /matching that only need
 * this plain <span> were pulling ~45KB gz of motion runtime into their
 * first-load JS through the shared module.
 */
export function RequiredMark({ label = 'required' }: { label?: string }) {
  return (
    <span className="ml-1 text-sm font-semibold text-accent-400" aria-label={label} title={label}>
      *
    </span>
  );
}

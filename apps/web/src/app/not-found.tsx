import Link from "next/link";

/**
 * Global 404 page. App Router renders this whenever `notFound()` is called
 * (e.g. an unknown horoscope sign or city slug) — giving a branded page and,
 * importantly, a real 404 status instead of a soft-404 for crawlers.
 */
export default function NotFound() {
  return (
    <div className="relative min-h-[60vh] flex flex-col items-center justify-center px-4 text-center fade-in-up">
      <p className="text-6xl font-bold text-gradient">404</p>
      <h1 className="mt-4 text-xl font-semibold text-surface-950">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-[rgba(12,8,5,0.55)]">
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl btn-primary px-5 py-2.5 text-sm font-medium"
      >
        Back to home
      </Link>
    </div>
  );
}

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone/server.js) so the
  // Docker/k8s web image can actually boot — the Dockerfile copies
  // `.next/standalone` and runs `node server.js`, which only exists with this.
  // Vercel ignores `output` and builds normally, so this is a no-op there.
  output: "standalone",
  images: {
    // AVIF first (30-50% smaller than WebP for photos), WebP fallback.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        // Narrowed from "**.amazonaws.com" (any S3 bucket on the internet —
        // an open image-optimizer proxy) to our upload region. Widen only for
        // hosts we actually serve from.
        hostname: "*.s3.ap-south-1.amazonaws.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Rewrite named imports from these barrel packages to per-module paths so
    // only what's actually used ships. @tabler/icons-react in particular routes
    // named imports through its index and would otherwise pull the whole icon
    // set; lucide-react / framer-motion / react-hot-toast benefit similarly.
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "framer-motion",
      "react-hot-toast",
    ],
  },
  // X-Robots-Tag noindex for per-user / internal app surfaces. robots.txt
  // disallows crawling these, but only a noindex signal removes an
  // already-discovered URL from the index — belt (page metadata where the
  // route has a server wrapper) and suspenders (this header for all of them).
  async headers() {
    const noindex = [
      "/styleguide", "/chat", "/my-day", "/reports", "/referral",
      "/decision-room", "/horary/ask", "/horary/history",
      "/profile", "/checkout", "/auth", "/reset-password", "/admin/:path*",
    ];
    return noindex.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
  // Branded, same-origin Firebase auth: serve the OAuth handler pages from
  // OUR host instead of jyotron-8a830.firebaseapp.com. With
  // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.myastro360.com, signInWithPopup
  // opens www.myastro360.com/__/auth/handler and these rewrites proxy the
  // request to Firebase's hosted handler (the documented reverse-proxy
  // pattern). Users see our domain in the popup, and the flow is same-origin
  // with the app — immune to third-party cookie/storage partitioning.
  // Requires (console, one-time): the domain in Firebase Auth ➜ Settings ➜
  // Authorized domains, and https://www.myastro360.com/__/auth/handler as an
  // authorized redirect URI on the Google OAuth web client.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://jyotron-8a830.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://jyotron-8a830.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
  // Canonical host: 301 the apex (myastro360.com) to www, which is what
  // `metadataBase`, the sitemap, robots and every canonical URL already use.
  // Without this, Google can crawl both hosts as separate copies and split
  // ranking signals between them. A permanent redirect collapses them onto
  // one host. (Vercel can also do this at the domain level; this keeps the
  // behaviour explicit and version-controlled, and is a no-op once the apex
  // already 301s.)
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "myastro360.com" }],
        destination: "https://www.myastro360.com/:path*",
        permanent: true,
      },
    ];
  },
};

const analyzedConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);

export default withSentryConfig(analyzedConfig, {
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});

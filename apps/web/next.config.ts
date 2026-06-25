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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
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

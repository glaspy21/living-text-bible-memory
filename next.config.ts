import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser-test server uses its own folder so it can run beside `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  /* config options here */
  cacheComponents: true,
  async redirects() {
    // Until Recently Studied exists (M8), Read opens John 1.
    return [{ source: "/read", destination: "/read/john/1", permanent: false }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

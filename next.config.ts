import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.brandfetch.io" }],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Pin the workspace root to THIS project. A stray pnpm-lock.yaml in the home
  // folder made Turbopack infer the home dir as root and fail to resolve modules
  // like next-auth / tailwindcss. process.cwd() is the project dir when running
  // `npm run dev` / `dev:https` from here, forcing resolution against ./node_modules.
  turbopack: {
    root: process.cwd(),
  },
  // reactCompiler disabled: its Babel plugin runs through Turbopack's webpack-loader
  // path, which panics when the project path contains a space ("PaperX project").
  // Re-enable once the folder is renamed to a space-free path.
  // reactCompiler: true,
};

export default nextConfig;

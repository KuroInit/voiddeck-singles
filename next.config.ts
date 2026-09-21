import type { NextConfig } from "next";

const securityHeaders = [
  // style/script 'unsafe-inline': Next.js injects inline bootstrap styles/scripts;
  // tightened to nonces would break the framework default — keep pragmatic.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // card art is hot-linked from Riot's CDN (various regional hosts)
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

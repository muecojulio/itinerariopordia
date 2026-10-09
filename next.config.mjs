const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  // unsafe-inline sigue siendo necesaria para los scripts en línea de Next;
  // unsafe-eval solo en desarrollo (el tooling de dev lo exige).
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  // Anti-clickjacking fuerte en producción. En desarrollo se omite para no
  // romper previsualizaciones embebidas (iframe).
  ...(isProd ? ["frame-ancestors 'none'"] : [])
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), microphone=(), camera=(), payment=(), usb=()"
  },
  { key: "Content-Security-Policy", value: csp },
  ...(isProd
    ? [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
      ]
    : [])
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  }
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The web app must never call external APIs from the browser. All external data
  // flows through /api/cron/poll → cache, or the ML pipeline → public/oracle.
  // public/oracle lives at the repo root, two levels up from apps/web.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
};

export default nextConfig;

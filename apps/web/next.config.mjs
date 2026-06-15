/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The web app must never call external APIs from the browser. All external data
  // flows through /api/cron/poll → cache, or the ML pipeline → oracle-data/.
  // Pin the tracing root to apps/web so the Vercel build (rooted here) never reaches
  // outside the project root for file tracing.
  outputFileTracingRoot: new URL('.', import.meta.url).pathname,
};

export default nextConfig;

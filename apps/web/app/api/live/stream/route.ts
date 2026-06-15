import { getLive } from '@/lib/live';
import { hasActiveWindow } from '@/lib/schedule';

// SSE push of the live snapshot (PLAN.md §7 Phase 5) — lower latency than polling on runtimes
// that sustain connections. The stream is BOUNDED (a handful of pushes, then it closes) so it
// never pins a serverless function for long; EventSource auto-reconnects. The client
// (useLiveStream) falls back to CDN-cached polling if SSE is unavailable — which stays the
// scalable default on Vercel Hobby (see docs/INTEGRATIONS.md).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PUSHES = 6;

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let cancelled = false;
      let count = 0;

      const push = async () => {
        if (cancelled) return false;
        try {
          const snap = await getLive();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snap)}\n\n`));
          // Push faster while a match is active; slower when idle.
          return hasActiveWindow(snap, Date.now());
        } catch {
          return false;
        }
      };

      await push();
      const loop = async () => {
        while (!cancelled && count < MAX_PUSHES) {
          const active = await push();
          count++;
          await new Promise((r) => setTimeout(r, active ? 15_000 : 30_000));
        }
        if (!cancelled) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      void loop();

      // @ts-expect-error attach for cancel()
      controller._stop = () => {
        cancelled = true;
      };
    },
    cancel() {
      // Client disconnected.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

import { getLive } from '@/lib/live';
import { hasActiveWindow } from '@/lib/schedule';

// SSE push of the live snapshot (PLAN.md §7 Phase 5). Lower latency than polling on runtimes
// that sustain connections. The stream is BOUNDED well under serverless function limits so it
// never hangs; the client (useLiveStream) reconnects, and falls back to CDN-cached polling —
// which stays the scalable default on Vercel Hobby (SSE is opt-in via NEXT_PUBLIC_ENABLE_SSE).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // keep within Hobby's function ceiling

const MAX_PUSHES = 3;

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let cancelled = false;
  const stop = () => {
    cancelled = true;
  };
  // Stop promptly when the client disconnects.
  req.signal.addEventListener('abort', stop);

  const stream = new ReadableStream({
    async start(controller) {
      const send = async (): Promise<boolean> => {
        if (cancelled) return false;
        try {
          const snap = await getLive();
          if (cancelled) return false;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snap)}\n\n`));
          return hasActiveWindow(snap, Date.now());
        } catch {
          return false;
        }
      };

      let active = await send();
      for (let i = 0; i < MAX_PUSHES && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, active ? 7_000 : 9_000));
        active = await send();
      }
      if (!cancelled) {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      stop();
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

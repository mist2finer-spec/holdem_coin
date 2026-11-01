import {storageStatus} from '../../../lib/game-storage';
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { revision: process.env.RENDER_GIT_COMMIT || "development", storage:storageStatus() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

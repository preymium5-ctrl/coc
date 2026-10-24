import { apiResponse, configuration } from "../../../lib/coc-service.mjs";

export const dynamic = "force-dynamic";

export function GET() {
  return apiResponse({ connected: !!configuration().token, provider: "Supercell", historyProvider: "ClashKing" });
}

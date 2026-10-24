import { apiResponse, errorResponse, getPlayer } from "../../../../lib/coc-service.mjs";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const { tag } = await params;
    return apiResponse(await getPlayer(tag));
  } catch (error) {
    return errorResponse(error);
  }
}

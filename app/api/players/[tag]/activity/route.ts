import {authorizeMember} from '../../../../../lib/site-access';
import { apiResponse, errorResponse, getActivity } from "../../../../../lib/coc-service.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const tag = await authorizeMember(request,(await params).tag);
    const query = new URL(request.url).searchParams;
    return apiResponse(await getActivity(tag, {
      groupTag: query.get("group") || undefined,
      seasonId: Number(query.get("season")) || undefined,
      groupMode: query.get("mode") === "legend" ? "legend" : "ranked",
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

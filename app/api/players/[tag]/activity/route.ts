import {authorizeMember} from '../../../../../lib/site-access';
import { apiResponse, errorResponse, getActivity } from "../../../../../lib/coc-service.mjs";
import {cachedHourly} from '../../../../../lib/clan-store';

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const tag = await authorizeMember(request,(await params).tag);
    const query = new URL(request.url).searchParams;
    const options={
      groupTag: query.get("group") || undefined,
      seasonId: Number(query.get("season")) || undefined,
      groupMode: query.get("mode") === "legend" ? "legend" : "ranked",
    };
    return apiResponse(await cachedHourly('player-activity:'+tag+':'+JSON.stringify(options),()=>getActivity(tag,options)));
  } catch (error) {
    return errorResponse(error);
  }
}

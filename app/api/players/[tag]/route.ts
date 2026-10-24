import {authorizeMember} from '../../../../lib/site-access';
import { apiResponse, errorResponse } from "../../../../lib/coc-service.mjs";
import {getPublicProfile} from '../../../../lib/clan-service';

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const tag = await authorizeMember(request,(await params).tag);
    return apiResponse(await getPublicProfile(tag));
  } catch (error) {
    return errorResponse(error);
  }
}

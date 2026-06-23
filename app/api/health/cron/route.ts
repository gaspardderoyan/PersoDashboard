import { handleHealthCronRequest } from "@/src/health/cron-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleHealthCronRequest(request, {
    env: process.env,
  });
}

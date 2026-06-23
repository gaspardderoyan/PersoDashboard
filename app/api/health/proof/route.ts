import { handleHealthProofRequest } from "@/src/health/proof-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleHealthProofRequest(request, {
    env: process.env,
  });
}

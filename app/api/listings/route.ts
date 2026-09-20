import { getAllListings, getListings } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  const listings =
    mode === "sale" || mode === "wtb" ? await getListings(mode) : await getAllListings();
  return Response.json({ listings });
}

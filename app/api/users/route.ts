import { listUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ users: listUsers() });
}

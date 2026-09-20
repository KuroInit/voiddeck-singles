import { getCurrentUser, signUpOrSwitch, validateHandle } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ user });
}

export async function POST(request: Request) {
  let body: { handle?: unknown };
  try {
    body = (await request.json()) as { handle?: unknown };
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (typeof body.handle !== "string" || !validateHandle(body.handle)) {
    return Response.json({ error: "INVALID_HANDLE" }, { status: 400 });
  }
  try {
    const user = await signUpOrSwitch(body.handle);
    return Response.json({ user });
  } catch (err) {
    // Handles are UNIQUE in the users table; a genuine insert conflict (e.g.
    // two concurrent signups for the same new handle) is a 409, not a 500.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE")) {
      return Response.json({ error: "HANDLE_TAKEN" }, { status: 409 });
    }
    throw err;
  }
}

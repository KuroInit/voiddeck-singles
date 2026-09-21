import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { getDb } from "./db";

export type User = { id: string; handle: string; kind: "seed" | "user" };

export const USER_COOKIE = "vds_user";
const HANDLE_MIN = 2;
const HANDLE_MAX = 24;

/** Trims and length-validates a handle; null when invalid. */
export function validateHandle(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const handle = raw.trim();
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) return null;
  return handle;
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    handle: String(r.handle),
    kind: r.kind === "seed" ? "seed" : "user",
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const id = store.get(USER_COOKIE)?.value;
  if (!id) return null;
  const row = getDb().prepare("SELECT id, handle, kind FROM users WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToUser(row) : null;
}

/** Creates the user when the handle is new; otherwise switches to it. Sets the session cookie. */
export async function signUpOrSwitch(handle: string): Promise<User> {
  const clean = validateHandle(handle);
  if (!clean) throw new Error("INVALID_HANDLE");
  const db = getDb();
  const existing = db.prepare("SELECT id, handle, kind FROM users WHERE handle = ?").get(clean) as
    | Record<string, unknown>
    | undefined;
  let user: User;
  if (existing) {
    user = rowToUser(existing);
  } else {
    user = { id: `u-${Date.now()}-${randomUUID().slice(0, 8)}`, handle: clean, kind: "user" };
    db.prepare("INSERT INTO users (id, handle, kind, created_at) VALUES (?, ?, 'user', ?)").run(
      user.id,
      user.handle,
      new Date().toISOString(),
    );
  }
  const store = await cookies();
  store.set(USER_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return user;
}

export function listUsers(): User[] {
  const rows = getDb()
    .prepare(
      `SELECT id, handle, kind FROM users
       ORDER BY CASE WHEN kind = 'seed' THEN 0 ELSE 1 END, handle ASC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToUser);
}

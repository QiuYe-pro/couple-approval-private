import { NextResponse, type NextRequest } from "next/server";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const username = (body?.username ?? "").toString().trim();
  const password = (body?.password ?? "").toString();

  const aUser = process.env.USER_A_USERNAME || "qiuyue";
  const aPass = process.env.USER_A_PASSWORD || "";
  const bUser = process.env.USER_B_USERNAME || "yael";
  const bPass = process.env.USER_B_PASSWORD || "";

  // Fail-closed: if passwords not configured, do not allow login.
  if (!aPass || !bPass) {
    return json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  let userId: "A" | "B" | null = null;
  if (username === aUser && password === aPass) userId = "A";
  if (username === bUser && password === bPass) userId = "B";
  if (!userId) return json({ ok: false, error: "Invalid credentials" }, { status: 401 });

  const res = json({ ok: true, userId }, { status: 200 });
  res.cookies.set("couple_session", userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}


import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const v = req.cookies.get("couple_session")?.value;
  const userId = v === "A" || v === "B" ? v : null;
  return NextResponse.json({ ok: true, userId });
}


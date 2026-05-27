import { NextResponse, type NextRequest } from "next/server";
import { kv } from "@vercel/kv";

type UserId = "A" | "B";

type RequestItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  applyAt: string;
  executeAt: string;
  priority: string;
  applicantId: UserId;
  approverId: UserId;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  timeline: Array<{ id: string; at: string; type: string; by: UserId; comment: string }>;
};

const KEY = "couple:requests:v1";

function getSessionUser(req: NextRequest): UserId | null {
  const v = req.cookies.get("couple_session")?.value;
  return v === "A" || v === "B" ? v : null;
}

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

async function loadAll(): Promise<RequestItem[]> {
  const arr = (await kv.get<RequestItem[]>(KEY)) || [];
  return Array.isArray(arr) ? arr : [];
}

async function saveAll(items: RequestItem[]) {
  await kv.set(KEY, items);
}

export async function GET() {
  const items = await loadAll();
  // public read: anyone can view
  return json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const userId = getSessionUser(req);
  if (!userId) return json({ ok: false, error: "Login required" }, { status: 401 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const item = body?.item as RequestItem | undefined;
  if (!item?.id) return json({ ok: false, error: "Invalid payload" }, { status: 400 });

  // basic sanity: only A/B
  if (item.applicantId !== "A" && item.applicantId !== "B") return json({ ok: false, error: "Invalid applicant" }, { status: 400 });
  if (item.approverId !== "A" && item.approverId !== "B") return json({ ok: false, error: "Invalid approver" }, { status: 400 });

  // enforce: applicant must match session user when creating new item
  const all = await loadAll();
  const exists = all.find((x) => x.id === item.id);
  if (exists) return json({ ok: false, error: "Already exists" }, { status: 409 });
  if (item.applicantId !== userId) return json({ ok: false, error: "Applicant mismatch" }, { status: 403 });

  all.push(item);
  await saveAll(all);
  return json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const userId = getSessionUser(req);
  if (!userId) return json({ ok: false, error: "Login required" }, { status: 401 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const item = body?.item as RequestItem | undefined;
  if (!item?.id) return json({ ok: false, error: "Invalid payload" }, { status: 400 });

  const all = await loadAll();
  const idx = all.findIndex((x) => x.id === item.id);
  if (idx < 0) return json({ ok: false, error: "Not found" }, { status: 404 });

  const cur = all[idx];

  // write rules:
  // - applicant can update when returned/pending (edit/cancel/resubmit)
  // - approver can update when pending (approve/reject/return)
  const applicantWrite = cur.applicantId === userId && (cur.status === "returned" || cur.status === "pending");
  const approverWrite = cur.approverId === userId && cur.status === "pending";
  if (!applicantWrite && !approverWrite) return json({ ok: false, error: "Forbidden" }, { status: 403 });

  all[idx] = item;
  await saveAll(all);
  return json({ ok: true });
}


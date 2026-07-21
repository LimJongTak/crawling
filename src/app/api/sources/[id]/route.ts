import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.url === "string" && body.url.trim()) data.url = body.url.trim();
  if (typeof body?.linkPattern === "string") data.linkPattern = body.linkPattern.trim() || null;
  if (typeof body?.contentSelector === "string") data.contentSelector = body.contentSelector.trim() || null;
  if (typeof body?.closedSelector === "string") data.closedSelector = body.closedSelector.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
  }

  const source = await prisma.source.update({ where: { id: params.id }, data }).catch(() => null);
  if (!source) return NextResponse.json({ error: "소스를 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json(source);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.source.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

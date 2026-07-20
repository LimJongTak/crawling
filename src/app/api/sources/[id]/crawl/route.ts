import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crawlSource } from "@/lib/crawler";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const source = await prisma.source.findUnique({ where: { id: params.id } });
  if (!source) {
    return NextResponse.json({ error: "소스를 찾을 수 없습니다." }, { status: 404 });
  }

  const result = await crawlSource(source);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

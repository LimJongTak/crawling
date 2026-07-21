import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const sources = await prisma.source.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: true, _count: { select: { posts: true } } },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { name, url, categoryId, type, linkPattern, contentSelector, closedSelector } = body ?? {};

  if (!name?.trim() || !url?.trim() || !categoryId) {
    return NextResponse.json({ error: "name, url, categoryId는 필수입니다." }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "url 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const sourceType = type === "KAGGLE_API" || type === "DAKER_API" ? type : "GENERIC_LINKS";

  if (sourceType === "GENERIC_LINKS") {
    if (!linkPattern?.trim()) {
      return NextResponse.json(
        { error: "GENERIC_LINKS 타입은 linkPattern(상세글 링크 정규식)이 필요합니다." },
        { status: 400 }
      );
    }
    try {
      new RegExp(linkPattern);
    } catch {
      return NextResponse.json({ error: "linkPattern이 올바른 정규식이 아닙니다." }, { status: 400 });
    }
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: "존재하지 않는 카테고리입니다." }, { status: 400 });
  }

  const source = await prisma.source.create({
    data: {
      name: name.trim(),
      url: url.trim(),
      type: sourceType,
      linkPattern: sourceType === "GENERIC_LINKS" ? linkPattern.trim() : null,
      contentSelector: sourceType === "GENERIC_LINKS" && contentSelector?.trim() ? contentSelector.trim() : null,
      closedSelector: sourceType === "GENERIC_LINKS" && closedSelector?.trim() ? closedSelector.trim() : null,
      categoryId,
    },
  });

  return NextResponse.json(source, { status: 201 });
}

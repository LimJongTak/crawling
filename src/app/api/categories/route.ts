import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function slugify(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `category-${Date.now()}`;
}

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { sources: true },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "카테고리 이름을 입력하세요." }, { status: 400 });
  }

  const count = await prisma.category.count();
  let slug = slugify(name);
  if (await prisma.category.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now()}`;
  }

  const category = await prisma.category.create({
    data: { name, slug, order: count },
  });
  return NextResponse.json(category, { status: 201 });
}

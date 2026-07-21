import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractDetailContent } from "@/lib/crawler/extractContent";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({ where: { id: params.id }, include: { source: true } });
  if (!post) {
    return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
  }

  if (post.content) {
    return NextResponse.json({ content: post.content });
  }

  try {
    const content = await extractDetailContent(post.url, post.source.contentSelector);
    if (content) {
      await prisma.post.update({ where: { id: post.id }, data: { content } });
    }
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ content: null, error: message });
  }
}

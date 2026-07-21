import { prisma } from "@/lib/db";
import type { Source } from "@prisma/client";
import { crawlGenericSource } from "./generic";
import { crawlKaggleCompetitions } from "./kaggle";
import { crawlDakerHackathons } from "./daker";
import type { CrawledItem } from "./types";

export interface CrawlResult {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  foundCount: number;
  newCount: number;
  error?: string;
}

async function fetchItems(source: Source): Promise<CrawledItem[]> {
  switch (source.type) {
    case "KAGGLE_API":
      return crawlKaggleCompetitions();
    case "DAKER_API":
      return crawlDakerHackathons();
    case "GENERIC_LINKS":
    default:
      return crawlGenericSource(source);
  }
}

export async function crawlSource(source: Source): Promise<CrawlResult> {
  try {
    const items = await fetchItems(source);
    let newCount = 0;

    // 같은 글이라도 크롤링 때마다 트래킹용 쿼리스트링이 다른 href가 선택될 수 있어(generic.ts 참고),
    // url만으로는 이전에 저장해둔 글과 매칭이 안 될 수 있다. 이 소스에 이미 저장된 글들의 dedupeKey를
    // 미리 뽑아두고, url이 정확히 같지 않아도 dedupeKey가 같으면 같은 글로 보고 갱신한다.
    const dedupePattern = source.linkPattern ? new RegExp(source.linkPattern.replace(/^\^/, "")) : null;
    const existingIdByDedupeKey = new Map<string, string>();
    if (dedupePattern) {
      const existingPosts = await prisma.post.findMany({
        where: { sourceId: source.id },
        select: { id: true, url: true },
      });
      for (const p of existingPosts) {
        const key = p.url.match(dedupePattern)?.[0];
        if (key) existingIdByDedupeKey.set(key, p.id);
      }
    }

    for (const item of items) {
      const existing = await prisma.post.findUnique({ where: { url: item.url } });
      const existingId = existing?.id ?? (item.dedupeKey ? existingIdByDedupeKey.get(item.dedupeKey) : undefined);

      if (existingId) {
        await prisma.post.update({
          where: { id: existingId },
          data: {
            title: item.title,
            url: item.url,
            lastSeenAt: new Date(),
            dateLabel: item.dateLabel,
            postedAt: item.postedAt,
            // content가 null인 건 "이번엔 안 가져옴"이지 "본문이 없어졌다"는 뜻이 아니라서
            // 이전에 캐시해둔 값(있다면)을 지우지 않는다.
            ...(item.content ? { content: item.content } : {}),
          },
        });
      } else {
        await prisma.post.create({
          data: {
            title: item.title,
            url: item.url,
            dateLabel: item.dateLabel,
            postedAt: item.postedAt,
            content: item.content,
            sourceId: source.id,
          },
        });
        newCount++;
      }
    }

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCrawledAt: new Date(),
        lastStatus: "success",
        lastError: null,
        lastFoundCount: items.length,
      },
    });

    return { sourceId: source.id, sourceName: source.name, ok: true, foundCount: items.length, newCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCrawledAt: new Date(),
        lastStatus: "error",
        lastError: message,
      },
    });
    return { sourceId: source.id, sourceName: source.name, ok: false, foundCount: 0, newCount: 0, error: message };
  }
}

export async function crawlAll(): Promise<CrawlResult[]> {
  const sources = await prisma.source.findMany({ where: { isActive: true } });
  const results: CrawlResult[] = [];
  for (const source of sources) {
    // 사이트에 부담을 주지 않도록 순차적으로 실행
    results.push(await crawlSource(source));
  }
  return results;
}

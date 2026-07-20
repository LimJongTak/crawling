import { prisma } from "@/lib/db";
import NavBar from "@/components/NavBar";
import { FeedPost } from "@/components/CategoryFeed";
import CategoryTabs, { CategoryData } from "@/components/CategoryTabs";

export const dynamic = "force-dynamic";

// 최근 크롤링에서 계속 재발견되는 글만 노출한다. 이 기간 동안 한 번도 다시 안 보이면
// 목록에서 사라진 것으로 보고 피드에서 숨긴다 (삭제는 아니라서 DB에는 그대로 남아있음).
const STALE_AFTER_DAYS = 7;

export default async function DashboardPage() {
  const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      sources: {
        include: {
          posts: {
            where: { lastSeenAt: { gte: staleCutoff } },
            orderBy: { firstSeenAt: "desc" },
            take: 50,
          },
        },
      },
    },
  });

  const categoryData: CategoryData[] = categories.map((category) => {
    const posts: FeedPost[] = category.sources.flatMap((s) =>
      s.posts.map((p) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        dateLabel: p.dateLabel,
        sortTime: (p.postedAt ?? p.firstSeenAt).toISOString(),
        firstSeenAt: p.firstSeenAt.toISOString(),
        sourceId: s.id,
        sourceName: s.name,
      }))
    );

    return { id: category.id, name: category.name, hasSources: category.sources.length > 0, posts };
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <NavBar active="home" />

      {categoryData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          아직 카테고리가 없습니다. 관리 페이지에서 카테고리와 링크를 추가해주세요.
        </div>
      ) : (
        <CategoryTabs categories={categoryData} />
      )}
    </main>
  );
}

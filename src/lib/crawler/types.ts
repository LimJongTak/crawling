export interface CrawledItem {
  title: string;
  url: string;
  dateLabel: string | null;
  postedAt: Date | null;
  content: string | null; // "HTML 복사"에 쓸 본문. 크롤링 시점에 알 수 있는 소스만 채우고, 나머지는 null
}

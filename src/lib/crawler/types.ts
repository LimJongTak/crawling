export interface CrawledItem {
  title: string;
  url: string;
  dateLabel: string | null;
  postedAt: Date | null;
  content: string | null; // "HTML 복사"에 쓸 본문. 크롤링 시점에 알 수 있는 소스만 채우고, 나머지는 null
  // linkPattern이 실제로 매칭한 부분(예: "/Recruit/GI_Read/49558396")만 뽑아낸 식별자.
  // 같은 글이라도 트래킹용 쿼리스트링만 다른 href가 여러 개 있을 수 있어(generic.ts 참고),
  // url이 매번 달라져도 이 값으로 동일 글 여부를 판별한다. GENERIC_LINKS에서만 채워진다.
  dedupeKey?: string;
}

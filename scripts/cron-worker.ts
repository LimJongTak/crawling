import cron from "node-cron";
import { crawlAll } from "../src/lib/crawler";

/**
 * Vercel처럼 서버리스 환경이 아니라 VPS/PM2 등 상시 구동되는 서버에 배포한 경우 사용.
 * `npm run cron` 으로 실행하면 매일 08:00(Asia/Seoul)에 전체 소스를 크롤링한다.
 * Vercel에 배포한다면 이 스크립트 대신 vercel.json의 cron 설정이 사용되므로 실행할 필요 없다.
 */
async function runOnce() {
  console.log(`[cron-worker] 크롤링 시작: ${new Date().toISOString()}`);
  const results = await crawlAll();
  for (const r of results) {
    console.log(
      `[cron-worker] ${r.sourceName}: ${r.ok ? `성공 (전체 ${r.foundCount}건, 신규 ${r.newCount}건)` : `실패 - ${r.error}`}`
    );
  }
}

cron.schedule("0 8 * * *", runOnce, { timezone: "Asia/Seoul" });
console.log("[cron-worker] 스케줄 등록 완료: 매일 08:00 (Asia/Seoul)");

if (process.argv.includes("--now")) {
  runOnce();
}

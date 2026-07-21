import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const contest = await prisma.category.upsert({
    where: { slug: "contest" },
    update: {},
    create: { name: "경진대회/해커톤", slug: "contest", order: 0 },
  });

  const job = await prisma.category.upsert({
    where: { slug: "job" },
    update: {},
    create: { name: "취업 관련 기타", slug: "job", order: 1 },
  });

  const sources = [
    {
      name: "데이콘 대회 목록",
      url: "https://dacon.io/competitions",
      type: "GENERIC_LINKS" as const,
      linkPattern: "^/competitions/official/\\d+",
      closedSelector: 'img[alt="non participating"]',
      categoryId: contest.id,
    },
    {
      name: "캐글 대회 목록",
      url: "https://www.kaggle.com/competitions",
      type: "KAGGLE_API" as const,
      linkPattern: null,
      categoryId: contest.id,
    },
    {
      name: "DAKER 해커톤 목록 (모집중만)",
      url: "https://daker.ai/public/hackathons",
      type: "DAKER_API" as const,
      linkPattern: null,
      categoryId: contest.id,
    },
    {
      name: "잡코리아 AI·개발·데이터 TOP100",
      url: "https://www.jobkorea.co.kr/Top100/?Main_Career_Type=1&Search_Type=1&BizJobtype_Bctgr_Code=10031&BizJobtype_Bctgr_Name=AI%C2%B7%EA%B0%9C%EB%B0%9C%C2%B7%EB%8D%B0%EC%9D%B4%ED%84%B0&BizJobtype_Code=0&BizJobtype_Name=AI%C2%B7%EA%B0%9C%EB%B0%9C%C2%B7%EB%8D%B0%EC%9D%B4%ED%84%B0+%EC%A0%84%EC%B2%B4&Major_Big_Code=0&Major_Big_Name=%EC%A0%84%EC%B2%B4&Major_Code=0&Major_Name=%EC%A0%84%EC%B2%B4&Edu_Level_Code=9&Edu_Level_Name=%EC%A0%84%EC%B2%B4&MidScroll=0&duty-depth2=on",
      type: "GENERIC_LINKS" as const,
      linkPattern: "/Recruit/GI_Read/\\d+",
      categoryId: job.id,
    },
    {
      name: "잡코리아 건축·시설 전기기사 TOP100",
      url: "https://www.jobkorea.co.kr/Top100/?Main_Career_Type=1&Search_Type=1&BizJobtype_Bctgr_Code=10043&BizJobtype_Bctgr_Name=%EA%B1%B4%EC%B6%95%C2%B7%EC%8B%9C%EC%84%A4&BizJobtype_Code=1000357&BizJobtype_Name=%EC%A0%84%EA%B8%B0%EA%B8%B0%EC%82%AC&Major_Big_Code=0&Major_Big_Name=%EC%A0%84%EC%B2%B4&Major_Code=0&Major_Name=%EC%A0%84%EC%B2%B4&Edu_Level_Code=9&Edu_Level_Name=%EC%A0%84%EC%B2%B4&MidScroll=&duty-depth1=on",
      type: "GENERIC_LINKS" as const,
      linkPattern: "/Recruit/GI_Read/\\d+",
      categoryId: job.id,
    },
    {
      name: "잡코리아 엔지니어링·설계 전기·전자엔지니어 TOP100",
      url: "https://www.jobkorea.co.kr/Top100/?Main_Career_Type=1&Search_Type=1&BizJobtype_Bctgr_Code=10040&BizJobtype_Bctgr_Name=%EC%97%94%EC%A7%80%EB%8B%88%EC%96%B4%EB%A7%81%C2%B7%EC%84%A4%EA%B3%84&BizJobtype_Code=1000326&BizJobtype_Name=%EC%A0%84%EA%B8%B0%C2%B7%EC%A0%84%EC%9E%90%EC%97%94%EC%A7%80%EB%8B%88%EC%96%B4&Major_Big_Code=0&Major_Big_Name=%EC%A0%84%EC%B2%B4&Major_Code=0&Major_Name=%EC%A0%84%EC%B2%B4&Edu_Level_Code=9&Edu_Level_Name=%EC%A0%84%EC%B2%B4&MidScroll=&duty-depth1=on",
      type: "GENERIC_LINKS" as const,
      linkPattern: "/Recruit/GI_Read/\\d+",
      categoryId: job.id,
    },
    {
      name: "순천대학교 모집·채용 게시판",
      url: "https://www.scnu.ac.kr/SCNU/na/ntt/selectNttList.do?mi=1189&bbsId=1068",
      type: "GENERIC_LINKS" as const,
      linkPattern: "selectNttInfo\\.do\\?nttSn=\\d+",
      contentSelector: "td.dragable",
      categoryId: job.id,
    },
  ];

  for (const s of sources) {
    const existing = await prisma.source.findFirst({ where: { url: s.url } });
    if (!existing) {
      await prisma.source.create({ data: s });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

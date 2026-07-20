# 정보 크롤링 트래커

로그인한 관리자만 볼 수 있는, 카테고리별(경진대회/해커톤, 취업 등) 크롤링 정보 대시보드.
매일 아침 8시(KST)에 등록된 링크들을 자동으로 크롤링해서 새 글을 모아 보여준다.

## 기술 스택

- Next.js 14 (App Router, TypeScript)
- Prisma + SQLite (로컬/VPS 기본값. 서버리스 배포 시 Postgres로 교체 권장)
- cheerio (정적 HTML 크롤링), Kaggle 공식 API (SPA라 별도 처리)
- jose 기반 세션 쿠키 로그인 (관리자 1인용)

## 시작하기

```bash
npm install
cp .env.example .env   # 값 채우기 (아래 참고)
npx prisma migrate dev --name init
npm run seed            # 기본 카테고리 + 4개 링크 등록
npm run dev
```

`http://localhost:3000/login` 에서 `.env`의 `ADMIN_PASSWORD`로 로그인.

## 환경변수 (.env)

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | Prisma 연결 문자열. 기본 `file:./dev.db` (SQLite) |
| `ADMIN_PASSWORD` | 로그인 비밀번호 |
| `SESSION_SECRET` | 로그인 세션 쿠키 서명용 랜덤 문자열 (32자 이상 권장) |
| `CRON_SECRET` | `/api/cron/crawl` 호출 인증용 랜덤 문자열 |
| `KAGGLE_USERNAME` / `KAGGLE_KEY` | Kaggle 대회 크롤링용 API 키. https://www.kaggle.com/settings → API → "Create New Token" |

## 링크(크롤링 대상) 추가하기

`/admin` 페이지에서 카테고리를 만들고 링크를 추가하면 된다. 사이트마다 마크업이 다르므로,
새 링크를 추가할 때 **목록 페이지 URL**과 **상세글 링크를 찾는 정규식(linkPattern)**을 입력해야 한다.

동작 방식: 목록 페이지 HTML을 가져와 `href`가 정규식에 매칭되는 `<a>` 태그를 모두 찾고,
그 앵커의 `title` 속성 → 내부 `img[alt]` → 텍스트 순으로 제목을 추정한다. 대부분의
게시판형 사이트(공지사항, 채용 리스트 등)는 이 방식으로 문제없이 동작한다.

이미 등록된 4개 링크의 정규식 예시:

- 데이콘: `^/competitions/official/\d+`
- 잡코리아: `/Recruit/GI_Read/\d+`
- 순천대 게시판: `selectNttInfo\.do\?nttSn=\d+`

**Kaggle은 예외**: `kaggle.com/competitions`는 완전한 SPA라서 정적 크롤링이 불가능하다.
대신 Kaggle 공식 API를 쓰므로, 링크 타입을 "Kaggle API 전용"으로 추가하면 목록 URL/정규식
입력 없이 동작한다 (단, `KAGGLE_USERNAME`/`KAGGLE_KEY` 설정 필요).

> 새로 추가하려는 사이트가 리액트/뷰 등으로 그려지는 SPA라면(페이지 소스를 봐도 목록 내용이 안 보이면)
> 같은 방식의 일반 크롤러로는 못 가져온다. 그런 사이트는 알려주면 별도 어댑터를 만들어야 한다.

## 오래된 게시물 자동 숨김

목록 페이지에서 더 이상 보이지 않는 글(예: 잡코리아 Top100처럼 순위가 매일 바뀌는 경우)이 피드에
계속 쌓이지 않도록, 최근 7일간의 크롤링에서 한 번도 재발견되지 않은 글은 대시보드에서 자동으로
숨긴다. 삭제하는 건 아니라서 DB에는 남아있고, 다시 목록에 나타나면 자동으로 다시 보인다.
기간을 바꾸고 싶으면 `src/app/page.tsx`의 `STALE_AFTER_DAYS` 값을 수정하면 된다.

## 매일 아침 8시 자동 크롤링

두 가지 방식을 모두 지원한다. 배포 환경에 맞는 쪽 하나만 쓰면 된다.

### 1) Vercel 등 서버리스에 배포하는 경우

`vercel.json`에 이미 cron이 설정되어 있다 (`0 23 * * *` UTC = 매일 08:00 KST).
Vercel 프로젝트 환경변수에 `CRON_SECRET`을 설정해두면, Vercel이 자동으로
`Authorization: Bearer <CRON_SECRET>` 헤더를 붙여 `/api/cron/crawl`을 호출한다.

**주의**: SQLite 파일은 서버리스 배포에서 영속되지 않는다. Vercel에 배포할 계획이면
Neon/Supabase 같은 호스팅 Postgres로 `DATABASE_URL`을 바꾸고 `prisma/schema.prisma`의
`datasource db.provider`를 `"postgresql"`로 변경한 뒤 `prisma migrate deploy`를 실행해야 한다.

### 2) VPS 등 상시 구동 서버에 배포하는 경우

SQLite 그대로 써도 된다. 앱과 별도로 아래 명령을 pm2 등으로 계속 띄워두면
node-cron이 매일 08:00(Asia/Seoul)에 자동 실행된다.

```bash
npm run cron
```

즉시 한 번 실행해보고 싶다면 `npm run cron -- --now`.

## 수동 크롤링

`/admin` 페이지의 각 링크 옆 "지금 크롤링" 버튼으로 즉시 실행할 수 있다.

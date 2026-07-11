# DART 재무제표 비교

회사명으로 검색해 3개 회사의 최근 3개년 재무제표(DART 사업보고서 주요계정)를 비교하고 엑셀로 다운로드하는 웹앱입니다. 데이터 출처는 금융감독원 전자공시시스템(DART) Open API입니다.

## 환경변수 설정

1. `.env.local.example`을 `.env.local`로 복사합니다.
2. https://opendart.fss.or.kr 에서 무료로 발급받은 인증키를 `DART_API_KEY`에 채워 넣습니다.
3. Vercel에 배포한 경우, 이 값을 로컬 파일이 아니라 **Vercel 프로젝트 Settings → Environment Variables**에 직접 등록해야 합니다 (이 저장소나 배포 스크립트로 자동 설정되지 않습니다).

## 회사 코드 목록 갱신

회사명 검색은 `data/corp-codes.json`(DART `corpCode.xml`을 미리 받아 `corp_code`/`corp_name`/`stock_code`만 남긴 정적 파일, 약 118,000건)을 읽어 처리합니다. 매 요청마다 DART에서 새로 받지 않고 빌드에 포함된 정적 파일을 쓰기 때문에, 신규 상장/사명 변경 등으로 데이터가 오래되면 아래 스크립트를 다시 실행해 결과 파일을 커밋해야 합니다.

```bash
DART_API_KEY=발급받은키 node scripts/generate-corp-codes.mjs
```

## 알려진 제약

- DART에 사업보고서를 제출하지 않는 회사(비상장·기타법인, 예: 쿠팡 주식회사)는 재무데이터가 없어 "이 회사는 DART 사업보고서 재무정보가 없습니다."라는 메시지가 표시됩니다. 버그가 아니라 DART의 데이터 공백입니다.
- `data/corp-codes.json`은 수동으로만 갱신되며 실시간이 아닙니다.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

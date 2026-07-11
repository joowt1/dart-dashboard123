// DART corpCode.xml을 내려받아 {corp_code, corp_name, stock_code}만 남긴 data/corp-codes.json 생성
// 수동 실행: DART_API_KEY=xxxx node scripts/generate-corp-codes.mjs
// Vercel 서버리스는 요청마다 이 118k건 zip을 새로 받을 수 없으므로, 결과 JSON을 저장소에 커밋해서 쓴다.
// 데이터가 오래되면 (신규 상장/사명 변경 등) 다시 실행해서 커밋해야 한다.

import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "data", "corp-codes.json");

async function main() {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    console.error("DART_API_KEY 환경변수가 없습니다. 예: DART_API_KEY=xxxx node scripts/generate-corp-codes.mjs");
    process.exit(1);
  }

  console.log("DART corpCode.xml 다운로드 중...");
  const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`);
  if (!res.ok) {
    console.error(`HTTP 오류: ${res.status}`);
    process.exit(1);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 인증키 오류 등은 zip이 아니라 XML 에러 응답으로 옴 (zip 시그니처 "PK" 확인)
  if (buffer.length < 2 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    console.error("zip 응답이 아닙니다 (인증키 오류 가능성). 응답 내용:");
    console.error(buffer.toString("utf-8").slice(0, 500));
    process.exit(1);
  }

  console.log("압축 해제 중...");
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry("CORPCODE.xml");
  if (!entry) {
    console.error("zip 안에 CORPCODE.xml이 없습니다.");
    process.exit(1);
  }
  const xml = zip.readAsText(entry, "utf-8");

  console.log("XML 파싱 중...");
  // parseTagValue:false 필수 - 기본값이면 "005930" 같은 숫자형 문자열의 앞자리 0이 날아감
  const parser = new XMLParser({ parseTagValue: false });
  const parsed = parser.parse(xml);
  let list = parsed?.result?.list ?? [];
  if (!Array.isArray(list)) list = [list]; // 항목이 1개뿐이면 배열이 아니라 객체로 옴

  const corpCodes = list.map((item) => ({
    corp_code: (item.corp_code ?? "").trim(),
    corp_name: (item.corp_name ?? "").trim(),
    stock_code: (item.stock_code ?? "").trim(),
  }));

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(corpCodes), "utf-8");

  console.log(`완료: ${corpCodes.length}개 회사 -> ${OUT_PATH}`);
  const sample = corpCodes.find((c) => c.corp_code === "00126380");
  console.log("샘플 확인 (삼성전자, 00126380):", sample);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

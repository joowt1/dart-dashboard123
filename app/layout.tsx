import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DART 재무제표 비교",
  description: "회사명으로 검색해 3개 회사의 3개년 재무제표를 비교하고 엑셀로 저장합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

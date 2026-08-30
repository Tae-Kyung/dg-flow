import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DG-Flow - 동일유리 주문관리 시스템',
  description: '주문의뢰서 입력, 승인, ERP 입력, 생산 모니터링 통합 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}

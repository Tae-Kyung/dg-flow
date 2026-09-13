import type { Metadata } from 'next';
import './globals.css';
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const plusJakarta = Plus_Jakarta_Sans({subsets:['latin'],variable:'--font-heading',weight:['600','700','800']});
const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="ko" className={cn("font-sans", inter.variable, plusJakarta.variable)}>
      <body className="min-h-screen bg-[var(--background)] antialiased">
        {children}
      </body>
    </html>
  );
}

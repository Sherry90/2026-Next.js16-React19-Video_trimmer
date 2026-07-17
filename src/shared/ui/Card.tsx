import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

/** 화면 중앙 카드 컨테이너 공용 chrome. 팔레트별 차이(dark variant, mt 등)는 className으로 확장. */
const VARIANTS = {
  white: 'w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg',
  red: 'w-full max-w-2xl mx-auto p-6 bg-red-50 border border-red-200 rounded-lg',
} as const;

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant: keyof typeof VARIANTS;
}

/**
 * 카드 컨테이너 프리미티브 — 업로드/다운로드 흰 카드, 에러 red 카드에서 반복되던 컨테이너.
 */
export function Card({ variant, className, ...props }: CardProps) {
  return <div className={cn(VARIANTS[variant], className)} {...props} />;
}

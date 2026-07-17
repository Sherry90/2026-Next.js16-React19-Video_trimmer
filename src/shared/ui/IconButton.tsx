import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

/** 컨트롤바 아이콘 버튼 공용 chrome (VolumeControl/QualitySelector 등에서 동일하게 반복되던 클래스). */
const BASE = 'flex items-center justify-center w-9 h-9 rounded text-white hover:bg-white/10 transition-colors';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * 아이콘 버튼 프리미티브 — 컨트롤바의 정사각 아이콘 버튼.
 * 크기/색/hover chrome을 공유하고, 추가 클래스는 className으로 확장한다.
 */
export function IconButton({ className, type = 'button', ...props }: IconButtonProps) {
  return <button type={type} className={cn(BASE, className)} {...props} />;
}

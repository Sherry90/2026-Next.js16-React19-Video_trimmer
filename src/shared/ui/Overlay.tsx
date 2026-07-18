import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** 래퍼(절대배치 레이어)에 덧붙일 클래스. rest props는 안쪽 텍스트 div로 전달(data-testid 등). */
  className?: string;
}

/**
 * 절대배치 중앙 메시지 오버레이 — 파형 loading/empty 상태처럼 겹쳐 뜨는 안내 레이어.
 * 래퍼는 inset-0 중앙정렬, 안쪽 텍스트 컨테이너에 메시지를 담는다.
 */
export function Overlay({ children, className, ...rest }: OverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-[#1c1d20] z-10",
        className,
      )}
    >
      <div className="text-xs text-[#74808c]" {...rest}>
        {children}
      </div>
    </div>
  );
}

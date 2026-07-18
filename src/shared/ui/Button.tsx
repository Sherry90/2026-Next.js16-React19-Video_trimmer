import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

/** primary = 앱 공용 파란 버튼(#2962ff). variant 미지정 시 base 리셋만 적용(호출부 className으로 완결). */
const PRIMARY =
  "text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5]";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary";
}

/**
 * 버튼 프리미티브 — raw <button> 대체.
 * variant='primary'는 공용 파란 chrome을 얹고, padding/disabled 등 호출부별 차이는 className으로 덮는다.
 * variant 미지정이면 className을 그대로 통과(픽셀 동일 유지하며 엘리먼트만 컴포넌트화).
 */
export function Button({ variant, className, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(variant === "primary" && PRIMARY, className)} {...props} />
  );
}

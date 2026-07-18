import type { ComponentPropsWithRef } from "react";
import { cn } from "@/shared/lib/cn";

type TextInputProps = ComponentPropsWithRef<"input">;

/**
 * 텍스트 인풋 프리미티브 — raw <input type="text">를 컴포넌트화.
 * 팔레트가 호출부마다 달라 공용 스타일은 두지 않고, 엘리먼트 일관성만 제공(className 통과).
 * React 19 ref-as-prop으로 ref는 props를 통해 그대로 전달된다.
 */
export function TextInput({ className, type = "text", ...props }: TextInputProps) {
  return <input type={type} className={cn(className)} {...props} />;
}

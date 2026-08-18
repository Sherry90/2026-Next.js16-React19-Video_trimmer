import type { IconProps } from "./types";

/**
 * 출력 게인(레벨) 아이콘 — 이퀄라이저 슬라이더 형태.
 * 미리보기 볼륨의 스피커 아이콘(VolumeIcon)과 의도적으로 다른 모양을 쓴다
 * (하나는 재생 볼륨, 하나는 결과물 게인 — 눈으로 구분되어야 한다).
 */
export function GainIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 20V14M6 10V4M12 20V12M12 8V4M18 20V16M18 12V4" />
      <path d="M3.5 12h5M9.5 10h5M15.5 14h5" />
    </svg>
  );
}

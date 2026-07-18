import type { IconProps } from "./types";

export function FullscreenExitIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
    </svg>
  );
}

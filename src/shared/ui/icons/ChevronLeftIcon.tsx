import type { IconProps } from "./types";

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 2 L3 6 L9 10" />
    </svg>
  );
}

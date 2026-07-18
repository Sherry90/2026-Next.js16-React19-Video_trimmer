import type { IconProps } from "./types";

export function ChevronRightIcon(props: IconProps) {
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
      <path d="M3 2 L9 6 L3 10" />
    </svg>
  );
}

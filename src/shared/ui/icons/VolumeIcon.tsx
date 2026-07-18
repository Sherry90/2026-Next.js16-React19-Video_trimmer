import type { IconProps } from "./types";

interface VolumeIconProps extends IconProps {
  /** true면 X(음소거), false면 음파 표시 */
  muted?: boolean;
}

export function VolumeIcon({ muted = false, ...props }: VolumeIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? (
        <path
          d="M16 9l5 5m0-5l-5 5"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M15.5 8.5a4 4 0 0 1 0 7M18 6a7 7 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

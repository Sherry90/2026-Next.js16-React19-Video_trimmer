/**
 * 출력 게인 표시 포맷. 부호와 단위를 항상 붙여 "무엇이 얼마나 적용되는지"를 명시한다.
 * 0은 부호 없이 `0 dB`(원본 그대로), 그 외는 `+3.0 dB` / `-6.0 dB`.
 */
export function formatGainDb(db: number): string {
  if (db === 0) return "0 dB";
  const sign = db > 0 ? "+" : "-";
  return `${sign}${Math.abs(db).toFixed(1)} dB`;
}

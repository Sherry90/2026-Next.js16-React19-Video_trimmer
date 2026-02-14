/**
 * CommonJS version of timeFormatter for server.js
 */

/**
 * 초 단위 시간을 HH:MM:SS 형식으로 변환 (streamlink용)
 */
function formatTimeHHMMSS(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
  formatTimeHHMMSS,
};

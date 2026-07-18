import type Player from "video.js/dist/types/player";
import { getStoreActions } from "@/stores/snapshot";
import { shouldAutoPauseAtOut } from "./playbackGuards";

/**
 * video.js player 이벤트를 store에 결선한다.
 *
 * VideoPlayerView의 player-ready 콜백에서 1회 호출(리스너 부착 타이밍 보존).
 * render 밖 콜백이므로 store 접근은 snapshot(getStoreActions)로 라이브 read —
 * 컴포넌트가 useStore를 직접 알 필요가 없다. 리스너 해제는 player.dispose()가 처리.
 *
 * - loadedmetadata: 파일 소스 duration backfill(이미 >0인 URL 소스는 보존).
 * - timeupdate: scrubbing/seeking 중이면 무시(race 방지), 아니면 currentTime 반영 +
 *   outPoint 도달 시 자동 정지.
 * - play/pause/ended: isPlaying 동기화.
 */
export function bindPlayerStoreSync(player: Player): void {
  player.on("loadedmetadata", () => {
    const duration = player.duration();
    const s = getStoreActions();
    // URL 스트리밍 소스는 resolve 메타데이터로 duration이 미리 설정됨(>0) → 덮어쓰지 않음.
    // 파일 소스는 duration=0으로 시작하므로 이때 설정.
    const hasDuration = (s.videoFile?.duration ?? 0) > 0;
    if (!hasDuration && duration && !isNaN(duration)) {
      s.setVideoDuration(duration);
    }
  });

  player.on("timeupdate", () => {
    const currentTime = player.currentTime() || 0;
    const s = getStoreActions();

    if (s.player.isScrubbing || player.seeking()) {
      return;
    }

    s.setCurrentTime(currentTime);

    if (shouldAutoPauseAtOut(currentTime, s.timeline.outPoint, player.paused())) {
      player.pause();
      player.currentTime(s.timeline.outPoint);
    }
  });

  player.on("play", () => getStoreActions().setIsPlaying(true));
  player.on("pause", () => getStoreActions().setIsPlaying(false));
  player.on("ended", () => getStoreActions().setIsPlaying(false));
}

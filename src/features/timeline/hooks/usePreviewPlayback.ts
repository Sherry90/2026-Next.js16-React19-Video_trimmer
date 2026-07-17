import { useCallback, useEffect, useRef } from 'react';
import { useVideoPlayerContext } from '@/shared/video-player/VideoPlayerContext';
import { PLAYBACK } from '@/constants/appConfig';

const HAVE_FUTURE_DATA = 3; // HTMLMediaElement.readyState — 재생 시작 가능 수준

/**
 * Preview playback (full segment + edges preview).
 *
 * 스트리밍 소스(URL editing) 대응: 모든 재생 진입을 buffer-aware `seekAndPlay`로
 * 통과시킨다. 스트리밍에선 seek 후 타겟 세그먼트/바이트 버퍼링이 끝나야 재생 가능하므로
 * 준비를 기다린 뒤 play 한다.
 */
export function usePreviewPlayback(inPoint: number, outPoint: number) {
  const previewCheckTimeRef = useRef<(() => void) | null>(null);
  // 진행 중인 seekAndPlay의 정리 함수(리스너/타임아웃/isScrubbing 해제). 언마운트·재실행 시 호출.
  const pendingSeekCleanupRef = useRef<(() => void) | null>(null);
  const { seek, player, setIsScrubbing } = useVideoPlayerContext();

  /**
   * 버퍼 인지형 seek+play.
   * seek → (seeked + 준비) 대기 → play. 준비 전 play()로 인한 stall을 방지하고,
   * 프로그램적 seek 동안 isScrubbing=true로 VideoPlayerView timeupdate 경합을 차단한다.
   */
  const seekAndPlay = useCallback((time: number) => {
    if (!player) return;

    // 직전 seekAndPlay가 진행 중이면 정리(중첩 방지)
    if (pendingSeekCleanupRef.current) {
      pendingSeekCleanupRef.current();
      pendingSeekCleanupRef.current = null;
    }

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const onSeeked = () => doReadyCheck();
    const onCanPlay = () => doPlay();
    const onPlaying = () => finish();

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      player.off('seeked', onSeeked);
      player.off('canplay', onCanPlay);
      player.off('playing', onPlaying);
      pendingSeekCleanupRef.current = null;
      // seek/버퍼링 종료 → 일반 timeupdate(currentTime 기록, outPoint auto-pause) 재개 허용
      setIsScrubbing(false);
    };

    const doPlay = () => {
      player.off('canplay', onCanPlay);
      // play()는 Promise|undefined. seek이 pending play를 인터럽트하면 AbortError reject → 무시.
      Promise.resolve(player.play()).catch(() => {});
    };

    const doReadyCheck = () => {
      player.off('seeked', onSeeked);
      // 이미 충분히 버퍼됐으면 즉시, 아니면 canplay까지 대기
      if (player.readyState() >= HAVE_FUTURE_DATA) {
        doPlay();
      } else {
        player.one('canplay', onCanPlay);
      }
    };

    // 정리 핸들: 언마운트/중첩 시 강제 해제
    pendingSeekCleanupRef.current = finish;

    // 안전 타임아웃: 준비/재생 이벤트가 안 와도 강제 play 시도 + isScrubbing 해제(stuck 방지)
    timeoutId = setTimeout(() => {
      if (settled) return;
      doPlay();
      finish();
    }, PLAYBACK.PREVIEW_BUFFER_TIMEOUT_MS);

    setIsScrubbing(true);
    // 재생이 실제로 재개되면 isScrubbing 해제
    player.one('playing', onPlaying);
    player.one('seeked', onSeeked);
    seek(time);

    // 이미 같은 위치 등으로 seeked가 안 날 수 있는 경우 대비: 다음 틱에 준비 상태면 진행
    if (!player.seeking() && player.readyState() >= HAVE_FUTURE_DATA) {
      player.off('seeked', onSeeked);
      doPlay();
    }
  }, [player, seek, setIsScrubbing]);

  /**
   * Preview the full selected segment
   */
  const handlePreview = useCallback(() => {
    seekAndPlay(inPoint);
  }, [inPoint, seekAndPlay]);

  /**
   * Preview edges: plays first 5s, then jumps to last 5s
   * For short segments (<10s), plays the full segment instead
   */
  const handlePreviewEdges = useCallback(() => {
    if (!player) return;

    // Clean up any existing preview listener
    if (previewCheckTimeRef.current) {
      player.off('timeupdate', previewCheckTimeRef.current);
      previewCheckTimeRef.current = null;
    }

    const segmentDuration = outPoint - inPoint;

    // For short segments, just play the full thing
    if (segmentDuration < PLAYBACK.PREVIEW_LONG_SEGMENT_THRESHOLD_SEC) {
      handlePreview();
      return;
    }

    const firstSegmentEnd = inPoint + PLAYBACK.PREVIEW_EDGE_DURATION_SEC;
    let isTransitioning = false;

    // Start playback from the in point (buffer-aware)
    seekAndPlay(inPoint);

    // Monitor playback and jump to last 5s when first 5s completes
    const checkTime = () => {
      // 점프 seek 진행 중엔 재트리거 방지 (스트리밍 버퍼링 동안 seeking() true)
      if (isTransitioning || player.seeking()) return;

      const currentTime = player.currentTime();
      if (currentTime !== undefined && currentTime >= firstSegmentEnd) {
        isTransitioning = true;

        // timeupdate 리스너 해제 후 마지막 5s 구간으로 buffer-aware 점프
        player.off('timeupdate', checkTime);
        previewCheckTimeRef.current = null;

        const secondSegmentStart = outPoint - PLAYBACK.PREVIEW_EDGE_DURATION_SEC;
        player.pause();
        seekAndPlay(secondSegmentStart);
      }
    };

    previewCheckTimeRef.current = checkTime;
    player.on('timeupdate', checkTime);
  }, [inPoint, outPoint, player, handlePreview, seekAndPlay]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (previewCheckTimeRef.current && player) {
        player.off('timeupdate', previewCheckTimeRef.current);
        previewCheckTimeRef.current = null;
      }
      if (pendingSeekCleanupRef.current) {
        pendingSeekCleanupRef.current();
        pendingSeekCleanupRef.current = null;
      }
    };
  }, [player]);

  return {
    handlePreview,
    handlePreviewEdges,
  };
}

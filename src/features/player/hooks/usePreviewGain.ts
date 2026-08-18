import { useEffect, useState } from "react";
import type Player from "video.js/dist/types/player";
import { useOutputGainDb } from "@/stores/hooks";
import { attachPreviewGain, type PreviewGainHandle } from "@/lib/previewGain";

/**
 * 출력 게인을 미리보기 오디오 그래프에 연결한다.
 * player.volume()은 1.0이 상한이라 +dB 부스트를 표현할 수 없으므로 WebAudio GainNode를 사용한다.
 */
export function usePreviewGain(player: Player | null): void {
  const gainDb = useOutputGainDb();
  const [handle, setHandle] = useState<PreviewGainHandle | null>(null);

  useEffect(() => {
    if (!player) {
      return;
    }

    const playerElement = player.el();
    const videoElement = playerElement?.querySelector<HTMLVideoElement>("video");
    if (!videoElement) {
      return;
    }

    const nextHandle = attachPreviewGain(videoElement);
    let active = true;
    queueMicrotask(() => {
      if (active) setHandle(nextHandle);
    });
    if (!nextHandle) return;

    const onPlay = () => nextHandle.resume();
    player.on("play", onPlay);

    return () => {
      active = false;
      player.off("play", onPlay);
      nextHandle.detach();
      setHandle(null);
    };
  }, [player]);

  useEffect(() => {
    handle?.setGainDb(gainDb);
  }, [handle, gainDb]);
}

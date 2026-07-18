"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  useVideoFile,
  useTimelineZoomValue,
  useWaveformProgress,
  useProgressActions,
} from "@/stores/hooks";
import { UI, WAVEFORM_VIEW } from "@/constants/appConfig";
import {
  getWaveform,
  clearWaveform,
  shouldSkipWaveform,
  scalePeaksToDuration,
} from "@/shared/lib/waveformCache";
import { getSpectrogram, clearSpectrogram } from "@/shared/lib/spectrogramCache";
import { withRetry } from "@/shared/lib/retry";
import {
  isValidSpectrogramData,
  spectrogramFrameWidth,
  type SpectrogramData,
} from "@/shared/lib/spectrogram";
import { hslToRgb } from "@/shared/lib/color";
import { computeLocalSpectrogram } from "@/shared/lib/spectrogramLocal";
import { Overlay } from "@/shared/ui/Overlay";

type SpectrogramStatus = "idle" | "loading" | "ready" | "empty" | "error" | "skipped";

export function WaveformBackground() {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [hasAudio, setHasAudio] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 길이 초과로 파형을 생략한 상태 (no-audio와 구분된 안내 표시)
  const [skipped, setSkipped] = useState<boolean>(false);

  const videoFile = useVideoFile();
  const zoom = useTimelineZoomValue();
  const waveformProgress = useWaveformProgress();
  const { setProgress } = useProgressActions();
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const [spectrogram, setSpectrogram] = useState<SpectrogramData | null>(null);
  const [spectrogramStatus, setSpectrogramStatus] = useState<SpectrogramStatus>("idle");
  const [spectrogramMessage, setSpectrogramMessage] = useState<string>("");
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const renderSpectrogram = useCallback(() => {
    const canvas = spectrogramCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    // Safari 등 캔버스 per-dimension 한계(~16384)를 넘으면 빈 캔버스가 됨.
    // CSS 폭(width)은 그대로 두고 backing-store 해상도만 낮춰 정합은 유지.
    const MAX_CANVAS_DIM = 16384;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DIM / width);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = WAVEFORM_VIEW.SPECTRAL_BG;
    ctx.fillRect(0, 0, width, height);

    if (!spectrogram || spectrogram.frames.length === 0) return;

    const frames = spectrogram.frames;
    const binCount = frames[0]?.length ?? 1;

    // 프레임을 실제 시간 위치로 배치(videoFile.duration 기준 — playhead/핸들과 동일 축).
    // audioDur < videoDur 면 스펙트럴이 좌측만 덮고 우측은 여백(오디오가 영상보다 짧음).
    const frameWidth = spectrogramFrameWidth(
      spectrogram.duration,
      videoFile?.duration ?? 0,
      frames.length,
      width,
    );

    // 프레임을 frameCount×binCount 오프스크린 ImageData 한 장으로 채운 뒤
    // 메인 캔버스로 스케일 blit — fillRect 수만~수십만 회 대신 putImageData+drawImage 2회.
    const frameCount = frames.length;
    const offscreen = document.createElement("canvas");
    offscreen.width = frameCount;
    offscreen.height = binCount;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    const image = offCtx.createImageData(frameCount, binCount);
    for (let x = 0; x < frameCount; x++) {
      const frame = frames[x];
      for (let y = 0; y < frame.length; y++) {
        const intensity = Math.max(0, Math.min(1, frame[y]));
        const hue = WAVEFORM_VIEW.HUE_BASE - intensity * WAVEFORM_VIEW.HUE_RANGE;
        const saturation = WAVEFORM_VIEW.SAT_BASE + intensity * WAVEFORM_VIEW.SAT_RANGE;
        const lightness = WAVEFORM_VIEW.LIGHT_BASE + intensity * WAVEFORM_VIEW.LIGHT_RANGE;
        const [r, g, b] = hslToRgb(hue, saturation, lightness);
        // 저주파(y=0)를 하단에 배치 → row 뒤집기
        const row = binCount - 1 - y;
        const idx = (row * frameCount + x) * 4;
        image.data[idx] = r;
        image.data[idx + 1] = g;
        image.data[idx + 2] = b;
        image.data[idx + 3] = 255;
      }
    }
    offCtx.putImageData(image, 0, 0);

    // drawImage 로 frameWidth(=videoDuration 정합 폭)에 맞춰 가로 스케일, 세로는 height 가득.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, frameCount, binCount, 0, 0, frameCount * frameWidth, height);

    ctx.strokeStyle = WAVEFORM_VIEW.GRID_STROKE;
    ctx.lineWidth = 1;
    for (let i = 1; i < WAVEFORM_VIEW.GRID_DIVISIONS; i++) {
      const y = (height / WAVEFORM_VIEW.GRID_DIVISIONS) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [spectrogram, videoFile]);

  useEffect(() => {
    if (!videoFile) return;

    let cancelled = false;

    const createInstance = (extra?: { peaks?: number[][] }) => {
      if (!waveformRef.current) return null;

      // Cleanup previous instance
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }

      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: WAVEFORM_VIEW.WAVE_COLOR,
        progressColor: "transparent",
        cursorColor: "transparent",
        barWidth: zoom > 4 ? WAVEFORM_VIEW.BAR_WIDTH_ZOOMED : WAVEFORM_VIEW.BAR_WIDTH_DEFAULT,
        barGap: WAVEFORM_VIEW.BAR_GAP,
        height: 80,
        normalize: true,
        interact: false,
        hideScrollbar: true,
        // 줌은 부모 content track 폭(contentWidth)으로 처리 → fillParent 로 부모 폭을 정확히 채움.
        // 시간축은 videoFile.duration 단일 기준으로 강제(서버 오디오/디코드 길이 대신).
        ...(videoFile.duration > 0 ? { duration: videoFile.duration } : {}),
        ...(extra?.peaks ? { peaks: extra.peaks } : {}),
      });
      wavesurferRef.current = wavesurfer;
      return wavesurfer;
    };

    const initializeWaveSurfer = async () => {
      if (!waveformRef.current) return;

      setIsLoading(true);
      setSkipped(false);
      setProgress("waveform", 0);

      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }

      try {
        // URL 소스: 영상 전체를 받지 않고 서버에서 오디오-only peaks만 가져온다.
        if (videoFile.source === "url") {
          const target = videoFile.originalUrl;
          if (!target) {
            setHasAudio(false);
            setIsLoading(false);
            return;
          }

          // 길이 게이트: 너무 긴 소스는 파형 생략(전체 오디오 추출이 메모리/시간 한도 초과).
          // 진행 중인 prefetch 추출도 중단해 서버 낭비를 끊는다.
          if (shouldSkipWaveform(videoFile.duration)) {
            clearWaveform(target);
            setSkipped(true);
            setHasAudio(false);
            setIsLoading(false);
            setProgress("waveform", 100);
            return;
          }

          // URL 입력 시 prefetch된 캐시 Promise 소비 (재요청 없음, 진입~표시 공백 제거)
          let peaks: number[][];
          let duration: number;
          let serverSkipped: boolean | undefined;
          try {
            ({ peaks, duration, skipped: serverSkipped } = await getWaveform(target));
          } catch {
            if (cancelled) return;
            setHasAudio(false);
            setIsLoading(false);
            setProgress("waveform", 100);
            return;
          }
          if (cancelled) return;

          // 서버가 길이 초과 등으로 생략한 경우도 동일 안내
          if (serverSkipped) {
            setSkipped(true);
            setHasAudio(false);
            setIsLoading(false);
            setProgress("waveform", 100);
            return;
          }

          const hasPeaks = Array.isArray(peaks) && peaks[0]?.length > 0;

          // 추출 오디오 길이(duration)를 videoFile.duration 축에 맞게 peaks 스케일
          // → WaveSurfer가 폭에 가득 펴도 playhead/스펙트럴과 정합(우측 여백 포함).
          const scaledPeaks = scalePeaksToDuration(peaks, duration, videoFile.duration);

          // 사전 계산된 peaks로 렌더 (미디어 fetch 없음): create options로 주입
          const wavesurfer = createInstance({ peaks: scaledPeaks });
          if (!wavesurfer) return;

          wavesurfer.on("error", (error) => {
            console.warn("Waveform render error:", error);
            setHasAudio(false);
            setIsLoading(false);
            setProgress("waveform", 100);
          });

          setHasAudio(hasPeaks);
          setIsLoading(false);
          setProgress("waveform", 100);
          return;
        }

        // 파일 소스: 기존 방식 — 로컬 blob에서 직접 디코드
        const wavesurfer = createInstance();
        if (!wavesurfer) return;

        wavesurfer.on("loading", (percent) => setProgress("waveform", percent));
        wavesurfer.on("ready", () => {
          setIsLoading(false);
          setProgress("waveform", 100);
          setHasAudio(true);
        });
        wavesurfer.on("error", (error) => {
          console.warn("Waveform error (possibly no audio):", error);
          setHasAudio(false);
          setIsLoading(false);
          setProgress("waveform", 100);
        });

        wavesurfer.load(videoFile.url);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to create WaveSurfer:", error);
        setHasAudio(false);
        setIsLoading(false);
      }
    };

    // Use setTimeout to ensure DOM is ready
    const timer = setTimeout(initializeWaveSurfer, UI.WAVEFORM_INIT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [videoFile, setProgress]);

  // barWidth만 zoom 에 반응 — 인스턴스 재생성 없이 옵션만 갱신(줌마다 리로드/로딩 깜빡임 방지).
  useEffect(() => {
    wavesurferRef.current?.setOptions({
      barWidth: zoom > 4 ? WAVEFORM_VIEW.BAR_WIDTH_ZOOMED : WAVEFORM_VIEW.BAR_WIDTH_DEFAULT,
    });
  }, [zoom]);

  // 스펙트럼은 displayMode와 무관하게 영상 로드 시 백그라운드에서 미리 연산해 둔다.
  // → 'Spectral' 토글 시 새로 계산하지 않고 즉시 표시(파형과 동일하게 준비 완료 상태).
  useEffect(() => {
    if (!videoFile) return;
    let cancelled = false;

    const computeSpectrogramData = async () => {
      setSpectrogram(null);
      setSpectrogramStatus("loading");
      setSpectrogramMessage("");

      try {
        if (shouldSkipWaveform(videoFile.duration)) {
          if (videoFile.originalUrl) clearSpectrogram(videoFile.originalUrl);
          setSpectrogramStatus("skipped");
          setSpectrogramMessage("영상이 길어 스펙트럼을 생략했습니다");
          return;
        }

        // URL: 서버 fetch(내부 재시도). 파일: 로컬 연산 — 일시 실패 시 최대 3회 재시도.
        const data =
          videoFile.source === "url" && videoFile.originalUrl
            ? await getSpectrogram(videoFile.originalUrl)
            : await withRetry(() => computeLocalSpectrogram(videoFile.url, videoFile.duration));

        if (cancelled) return;
        if (!isValidSpectrogramData(data)) {
          setSpectrogramStatus("error");
          setSpectrogramMessage("스펙트럼 응답 형식이 올바르지 않습니다");
          return;
        }
        if (data.skipped) {
          setSpectrogramStatus("skipped");
          setSpectrogramMessage("영상이 길어 스펙트럼을 생략했습니다");
          return;
        }
        setSpectrogram(data);
        const hasFrames = data.frames.length > 0 && data.frames.some((frame) => frame.length > 0);
        setSpectrogramStatus(hasFrames ? "ready" : "empty");
        setSpectrogramMessage(hasFrames ? "" : "스펙트럼 데이터가 비어 있습니다");
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to compute spectrogram:", error);
        setSpectrogramStatus("error");
        setSpectrogramMessage("스펙트럼을 표시할 수 없습니다");
      }
    };

    computeSpectrogramData();
    return () => {
      cancelled = true;
    };
  }, [videoFile]);

  useEffect(() => {
    const target = waveformRef.current;
    if (!target) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(renderSpectrogram);
    return () => cancelAnimationFrame(frame);
  }, [renderSpectrogram, containerWidth, spectrogramStatus]);

  // 파형과 스펙트럴을 항상 겹쳐 표시 — 오버레이는 두 레이어의 합친 상태를 따른다.
  const spectralUnavailable =
    spectrogramStatus === "error" ||
    spectrogramStatus === "empty" ||
    spectrogramStatus === "skipped";
  // 둘 중 하나라도 준비 중이면 로딩 표시.
  const showLoading = isLoading || spectrogramStatus === "loading";
  // 파형도 없고 스펙트럴도 사용 불가일 때만 빈 상태.
  const showEmpty = !showLoading && !hasAudio && spectralUnavailable;

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none relative">
      <div className="absolute inset-0 bg-[#14161a]">
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_100%,100%_20px]" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-[#ffee65]/45" />
      </div>

      {/* 스펙트럴(아래 레이어) — 항상 표시 */}
      <canvas
        ref={spectrogramCanvasRef}
        data-testid="spectrogram-canvas"
        className="absolute inset-0 h-full w-full"
      />

      {/* 파형(위 레이어) — 반투명 + 블렌드로 스펙트럴 위에 겹침. ref 부착 위해 항상 렌더. */}
      <div
        ref={waveformRef}
        className="w-full h-full absolute inset-0"
        style={{
          opacity: WAVEFORM_VIEW.WAVE_OPACITY,
          mixBlendMode: WAVEFORM_VIEW.WAVE_BLEND_MODE,
        }}
      />

      {/* Loading overlay — 파형/스펙트럴 중 하나라도 준비 중 */}
      {showLoading && (
        <Overlay>
          {isLoading
            ? `Loading waveform... ${Math.round(waveformProgress)}%`
            : "스펙트럼 분석 중..."}
        </Overlay>
      )}

      {/* 빈 상태 — 파형도 없고 스펙트럴도 사용 불가 */}
      {!showLoading && showEmpty && (
        <Overlay data-testid="waveform-empty-message">
          {skipped ? "영상이 길어 파형을 생략했습니다" : spectrogramMessage || "No audio track"}
        </Overlay>
      )}
    </div>
  );
}

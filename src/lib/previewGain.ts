import { clampGainDb } from "./audioFilter";
import { registerCleanup } from "./cleanup";

const GAIN_RAMP_TIME_SECONDS = 0.03;

interface PreviewGainDebugPipeline {
  readonly context: AudioContext;
  readonly source: MediaElementAudioSourceNode;
  readonly gain: GainNode;
}

type PreviewGainDebugWindow = Window & {
  __previewGain?: PreviewGainDebugPipeline;
};

let sharedAudioContext: AudioContext | null = null;

/** element별 MediaElementAudioSourceNode를 한 번만 만든다. */
const handlesByElement = new WeakMap<HTMLMediaElement, PreviewGainHandleInternal>();

/** dB → 선형 배율. 0dB=1, +6dB≈1.995, +20dB=10. */
export function gainDbToLinear(gainDb?: number | null): number {
  return 10 ** (clampGainDb(gainDb) / 20);
}

export interface PreviewGainHandle {
  readonly context: AudioContext;
  readonly gain: GainNode;
  /** dB를 setTargetAtTime으로 램프 적용. 내부에서 resume()도 시도한다. */
  setGainDb(gainDb: number): void;
  /** suspended면 resume. */
  resume(): void;
  /** element 폐기 시 그래프 해제. 여러 번 호출해도 안전하다. */
  detach(): void;
}

interface PreviewGainHandleInternal extends PreviewGainHandle {
  readonly source: MediaElementAudioSourceNode;
  reconnect(): boolean;
}

function getSharedAudioContext(): AudioContext | null {
  if (sharedAudioContext?.state === "closed") sharedAudioContext = null;
  if (sharedAudioContext) return sharedAudioContext;
  if (typeof window === "undefined") return null;

  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    sharedAudioContext = new AudioContextCtor();
    return sharedAudioContext;
  } catch {
    sharedAudioContext = null;
    return null;
  }
}

function exposeDebugPipeline(
  context: AudioContext,
  source: MediaElementAudioSourceNode,
  gain: GainNode,
): void {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as PreviewGainDebugWindow).__previewGain = { context, source, gain };
  }
}

function clearDebugPipeline(source: MediaElementAudioSourceNode, gain: GainNode): void {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    const debugWindow = window as PreviewGainDebugWindow;
    if (debugWindow.__previewGain?.source === source && debugWindow.__previewGain.gain === gain) {
      delete debugWindow.__previewGain;
    }
  }
}

function createHandle(
  context: AudioContext,
  source: MediaElementAudioSourceNode,
  gain: GainNode,
): PreviewGainHandleInternal {
  let detached = false;

  const resume = () => {
    if (context.state !== "suspended") return;
    try {
      void context.resume().catch(() => {});
    } catch {
      // 브라우저가 resume을 거부해도 기존 video.js 재생은 계속 동작한다.
    }
  };

  const reconnect = () => {
    if (!detached) return context.state !== "closed";
    if (context.state === "closed") return false;

    try {
      source.connect(gain);
      gain.connect(context.destination);
      detached = false;
      exposeDebugPipeline(context, source, gain);
      return true;
    } catch {
      try {
        source.disconnect();
      } catch {
        // 이미 끊긴 노드일 수 있다.
      }
      try {
        gain.disconnect();
      } catch {
        // 이미 끊긴 노드일 수 있다.
      }
      return false;
    }
  };

  return {
    context,
    gain,
    source,
    setGainDb(gainDb) {
      if (detached || context.state === "closed") return;
      const target = gainDbToLinear(gainDb);
      resume();
      try {
        gain.gain.setTargetAtTime(target, context.currentTime, GAIN_RAMP_TIME_SECONDS);
      } catch {
        // AudioContext가 닫히는 순간의 경합은 미리보기 재생을 막지 않는다.
      }
    },
    resume,
    reconnect,
    detach() {
      if (detached) return;
      detached = true;
      try {
        source.disconnect();
      } catch {
        // 이미 끊긴 노드일 수 있다.
      }
      try {
        gain.disconnect();
      } catch {
        // 이미 끊긴 노드일 수 있다.
      }
      clearDebugPipeline(source, gain);
    },
  };
}

/**
 * element당 한 번만 그래프를 구성한다. 지원하지 않거나 구성에 실패하면 null을 반환한다.
 * 그래프는 0dB에서도 destination까지 연결된 상태를 유지한다.
 */
export function attachPreviewGain(el: HTMLMediaElement): PreviewGainHandle | null {
  try {
    const existingHandle = handlesByElement.get(el);
    if (existingHandle) return existingHandle.reconnect() ? existingHandle : null;

    const context = getSharedAudioContext();
    if (!context) return null;

    let source: MediaElementAudioSourceNode | null = null;
    let gain: GainNode | null = null;
    try {
      source = context.createMediaElementSource(el);
      gain = context.createGain();
      source.connect(gain);
      gain.connect(context.destination);

      const handle = createHandle(context, source, gain);
      handlesByElement.set(el, handle);
      exposeDebugPipeline(context, source, gain);
      return handle;
    } catch {
      try {
        source?.disconnect();
      } catch {
        // 부분적으로 생성된 노드일 수 있다.
      }
      try {
        gain?.disconnect();
      } catch {
        // 부분적으로 생성된 노드일 수 있다.
      }
      return null;
    }
  } catch {
    return null;
  }
}

function cleanupSharedAudioContext(): void {
  const context = sharedAudioContext;
  sharedAudioContext = null;
  if (!context || context.state === "closed") return;

  try {
    void context.close().catch(() => {});
  } catch {
    // 이미 닫히는 중인 AudioContext일 수 있다.
  }
}

registerCleanup(cleanupSharedAudioContext);

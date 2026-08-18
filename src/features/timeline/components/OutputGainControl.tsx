"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useOutputGainDb, useAudioActions } from "@/stores/hooks";
import { AUDIO } from "@/constants/appConfig";
import { GainIcon } from "@/shared/ui/icons";
import { formatGainDb } from "../utils/formatGainDb";

/** 자주 쓰는 게인 프리셋 (dB). */
const PRESETS = [-6, 0, 3, 6];

/**
 * 출력 게인 컨트롤 (connected) — 트리거 버튼 + 팝오버.
 *
 * 여기서 정한 값은 내보낼 파일의 오디오에 `volume=XdB`로 적용되고 미리보기에도 WebAudio
 * GainNode로 동일하게 반영된다. 플레이어 볼륨/뮤트(PlayerControls)와는 별개이며,
 * `player.volume()`은 여전히 건드리지 않는다.
 * 트리거 라벨에 현재 값을 항상 표시해, 팝오버를 닫아도 적용 여부가 보이게 한다.
 */
export function OutputGainControl() {
  const gainDb = useOutputGainDb();
  const { setOutputGainDb } = useAudioActions();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  const isBoosted = gainDb !== 0;

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // 외부 클릭 / Escape 닫기 — 열려 있을 때만 리스너를 붙인다.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        title="내보낼 파일과 미리보기의 오디오 게인 (플레이어 볼륨/뮤트와 별개)"
        className={`flex items-center gap-1.5 px-2.5 py-[7px] rounded-sm text-[13px] font-medium transition-colors cursor-pointer ${
          isBoosted
            ? "bg-[#2962ff]/20 text-[#2962ff] hover:bg-[#2962ff]/30"
            : "bg-white/10 text-[#d9dce3] hover:bg-white/15"
        }`}
      >
        <GainIcon className="w-4 h-4" />
        <span className="font-mono tabular-nums">{formatGainDb(gainDb)}</span>
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="출력 게인"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[260px] rounded bg-[#101114] border border-white/10 p-3 shadow-lg z-20"
        >
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[13px] font-semibold text-[#d9dce3]">출력 게인</span>
            <span className="text-[13px] font-mono tabular-nums text-[#ffee65]">
              {formatGainDb(gainDb)}
            </span>
          </div>
          <p className="text-[11px] text-[#74808c] mb-3 leading-snug">
            내보낼 파일과 미리보기에 적용됩니다 (플레이어 볼륨/뮤트와 별개). 크게 올리면 소리가 깨질
            수 있습니다.
          </p>

          <input
            type="range"
            min={AUDIO.MIN_GAIN_DB}
            max={AUDIO.MAX_GAIN_DB}
            step={AUDIO.GAIN_STEP_DB}
            value={gainDb}
            onChange={(e) => setOutputGainDb(parseFloat(e.target.value))}
            aria-label="출력 게인"
            aria-valuetext={formatGainDb(gainDb)}
            className="w-full h-1 accent-[#2962ff] cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-[#74808c] mt-1">
            <span>{AUDIO.MIN_GAIN_DB} dB</span>
            <span>0</span>
            <span>+{AUDIO.MAX_GAIN_DB} dB</span>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <GainNumberInput value={gainDb} onCommit={setOutputGainDb} />
            <div className="flex gap-1 ml-auto">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setOutputGainDb(preset)}
                  aria-pressed={gainDb === preset}
                  className={`px-2 py-1 rounded-sm text-[11px] font-mono transition-colors cursor-pointer ${
                    gainDb === preset
                      ? "bg-[#2962ff] text-white"
                      : "bg-white/10 text-[#d9dce3] hover:bg-white/15"
                  }`}
                >
                  {preset > 0 ? `+${preset}` : preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * dB 숫자 직접 입력. TimeInput과 동일한 규약 — 타이핑 중에는 로컬 문자열을 두고
 * blur/Enter에서만 커밋해, 입력 도중 store clamp가 커서를 흔들지 않게 한다.
 */
function GainNumberInput({ value, onCommit }: { value: number; onCommit: (db: number) => void }) {
  const inputId = useId();
  const [text, setText] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  // focus 중이 아닐 때만 외부 값과 동기화 (렌더 중 조정 — effect setState의 cascading 회피)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!isFocused) setText(String(value));
  }

  const commit = () => {
    setIsFocused(false);
    // 빈 문자열/파싱 실패는 0dB로 되돌린다(store의 constrainOutputGainDb가 최종 판정).
    onCommit(text.trim() === "" ? 0 : parseFloat(text));
  };

  return (
    <div className="flex items-center gap-1">
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        min={AUDIO.MIN_GAIN_DB}
        max={AUDIO.MAX_GAIN_DB}
        step={AUDIO.GAIN_STEP_DB}
        value={text}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label="출력 게인 (dB 직접 입력)"
        className="w-16 px-2 py-1 text-[13px] font-mono rounded-sm bg-[#212123] border border-white/10 text-[#d9dce3] focus:outline-none focus:ring-1 focus:ring-[#2962ff]"
      />
      <label htmlFor={inputId} className="text-[11px] text-[#74808c]">
        dB
      </label>
    </div>
  );
}

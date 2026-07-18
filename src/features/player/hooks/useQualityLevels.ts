"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Player from "video.js/dist/types/player";
import { getStoreActions } from "@/stores/snapshot";

/**
 * 화질 레벨 훅 — 기존 qualityMenuButton.ts(video.js MenuButton)의 로직을 React로 포팅.
 *
 * `videojs-contrib-quality-levels`의 `player.qualityLevels()`를 열거해 height 목록을 만들고,
 * 선택 시 해당 레벨만 enabled로 두어 화질을 고정한다(null=Auto=전부 enabled=ABR).
 * 사용자가 직접 고르기 전까지는 레벨이 채워질 때마다 기본 화질(1080, 없으면 최고)을 재적용한다
 * (VHS가 레벨을 점진 추가하므로 첫 이벤트에 고정하면 144p 등에 잘못 묶임).
 * 선택값은 store의 setSelectedQuality로 전달돼 최종 다운로드 화질과 일치시킨다.
 */
interface QualityLevel {
  height?: number;
  enabled: boolean;
}
interface QualityLevelList {
  length: number;
  [index: number]: QualityLevel;
  on(event: string, cb: () => void): void;
  off(event: string, cb: () => void): void;
}

const DEFAULT_TARGET = 1080;

export interface UseQualityLevels {
  heights: number[];
  selected: number | null; // null = Auto
  setQuality: (height: number | null) => void;
}

export function useQualityLevels(player: Player | null): UseQualityLevels {
  const [heights, setHeights] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const userChoseRef = useRef(false);

  // 최신 selected를 effect 밖에서 참조하기 위한 ref (effect deps는 player만)
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;

  useEffect(() => {
    userChoseRef.current = false;
    const p = player as unknown as { qualityLevels?: () => QualityLevelList } | null;
    const ql = p?.qualityLevels ? p.qualityLevels() : null;
    if (!ql) {
      setHeights([]);
      setSelected(null);
      return;
    }

    const computeHeights = (): number[] =>
      [
        ...new Set(
          Array.from({ length: ql.length }, (_, i) => ql[i].height).filter(
            (h): h is number => typeof h === "number" && h > 0,
          ),
        ),
      ].sort((a, b) => b - a);

    const apply = (height: number | null) => {
      for (let i = 0; i < ql.length; i++) {
        ql[i].enabled = height === null ? true : ql[i].height === height;
      }
      setSelected(height);
      getStoreActions().setSelectedQuality(height);
    };

    const refresh = () => {
      const hs = computeHeights();
      setHeights(hs);
      // 사용자 선택 전: 기본 화질 재적용
      if (!userChoseRef.current && hs.length > 0) {
        const target = hs.includes(DEFAULT_TARGET) ? DEFAULT_TARGET : hs[0];
        if (target !== selectedRef.current) apply(target);
      }
    };

    refresh();
    ql.on("addqualitylevel", refresh);
    ql.on("change", refresh);

    return () => {
      ql.off("addqualitylevel", refresh);
      ql.off("change", refresh);
    };
  }, [player]);

  const setQuality = useCallback(
    (height: number | null) => {
      userChoseRef.current = true;
      const p = player as unknown as { qualityLevels?: () => QualityLevelList } | null;
      const ql = p?.qualityLevels ? p.qualityLevels() : null;
      if (ql) {
        for (let i = 0; i < ql.length; i++) {
          ql[i].enabled = height === null ? true : ql[i].height === height;
        }
      }
      setSelected(height);
      getStoreActions().setSelectedQuality(height);
    },
    [player],
  );

  return { heights, selected, setQuality };
}

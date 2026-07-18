"use client";

import { useCallback, useState } from "react";
import { useExportResult, usePhaseActions, useReset } from "@/stores/hooks";

/**
 * 다운로드 화면 로직 — 파일명(base/ext) 분리, 편집 가능한 이름 상태, 다운로드 트리거,
 * 편집 복귀/새 파일 액션. 컴포넌트는 표시만 담당.
 */
export function useDownload() {
  const { outputUrl, outputFilename } = useExportResult();
  const { setPhase } = usePhaseActions();
  const reset = useReset();

  const lastDot = outputFilename ? outputFilename.lastIndexOf(".") : -1;
  const baseName = outputFilename
    ? lastDot !== -1
      ? outputFilename.slice(0, lastDot)
      : outputFilename
    : "";
  const ext = outputFilename && lastDot !== -1 ? outputFilename.slice(lastDot) : "";

  const [editableName, setEditableName] = useState("");

  // outputFilename이 바뀔 때만 편집 이름을 baseName으로 초기화 (렌더 중 조정 패턴).
  // effect 내 setState의 cascading 렌더를 피하고, 사용자 편집은 파일 변경 전까지 보존한다.
  const [prevFilename, setPrevFilename] = useState(outputFilename);
  if (outputFilename !== prevFilename) {
    setPrevFilename(outputFilename);
    if (outputFilename) setEditableName(baseName);
  }

  const triggerDownload = useCallback(
    (name: string) => {
      if (!outputUrl || !outputFilename) return;
      const link = document.createElement("a");
      link.href = outputUrl;
      link.download = name + ext;
      link.click();
    },
    [outputUrl, outputFilename, ext],
  );

  const handleDownload = useCallback(() => {
    triggerDownload(editableName.trim() || baseName);
  }, [triggerDownload, editableName, baseName]);

  const handleBackToEdit = useCallback(() => {
    setPhase("editing");
  }, [setPhase]);

  const handleEditAnother = useCallback(() => {
    reset();
  }, [reset]);

  return {
    outputUrl,
    outputFilename,
    ext,
    editableName,
    setEditableName,
    handleDownload,
    handleBackToEdit,
    handleEditAnother,
  };
}

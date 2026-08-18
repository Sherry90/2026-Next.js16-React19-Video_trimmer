import { createSimpleSelector, createStateSelector } from "../selectorFactory";

// ── audio (출력 게인) ──
// 내보낼 파일의 volume=XdB와 미리보기의 WebAudio GainNode에 함께 반영되는 게인.
// player.volume()이 담당하는 사용자 볼륨/뮤트와는 다른 축으로 둔다.
export const useOutputGainDb = createSimpleSelector((s) => s.audio.outputGainDb);

export const useAudioActions = createStateSelector((s) => ({
  setOutputGainDb: s.setOutputGainDb,
}));

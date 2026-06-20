// One-off generator for store-injecting owned previews. Produces files
// identical in shape to .design-sync/previews/Playhead.tsx (hand-authored,
// verified), parameterized by story-module path + export keys. Safe to delete.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'previews');

const comps = [
  ['UrlInputZone', 'src/features/url-input/components/UrlInputZone.stories', ['Default']],
  ['ErrorDisplay', 'src/features/export/components/ErrorDisplay.stories', ['ProcessingFailed', 'MemoryInsufficient', 'Unknown', 'ViaStore']],
  ['DownloadButton', 'src/features/export/components/DownloadButton.stories', ['Default', 'NoExtension', 'LongFilename']],
  ['ExportProgress', 'src/features/export/components/ExportProgress.stories', ['FileSource', 'UrlSource', 'Starting', 'AlmostDone']],
  ['TimelineBar', 'src/features/timeline/components/TimelineBar.stories', ['Default', 'NarrowSelection', 'FullRange']],
  ['TimelineEditor', 'src/features/timeline/components/TimelineEditor.stories', ['Default', 'BothLocked']],
  ['TrimHandle', 'src/features/timeline/components/TrimHandle.stories', ['InPoint', 'OutPoint', 'InPointLocked']],
  ['WaveformBackground', 'src/features/timeline/components/WaveformBackground.stories', ['WithVideoFile', 'NoVideoFile']],
  ['UploadZone', 'src/features/upload/components/UploadZone.stories', ['Default']],
  ['UploadProgress', 'src/features/upload/components/UploadProgress.stories', ['InProgress', 'AlmostDone']],
];

const tpl = (storyPath, exportLines) => `import * as React from 'react';
import * as S from "@ds-stories/${storyPath}";
// Shimmed to window.VideoTrimmerUI.useStore (cfg.storyImports.shim) so this is
// the SAME Zustand singleton the bundled components read.
import { useStore } from '@/stores/useStore';

// Mirrors .storybook/preview.tsx's global decorator: reset the store, then
// inject this story's parameters.storeState synchronously during render, so the
// component reads the populated store on its first paint. Applied OUTERMOST.
// Per-story (?story=) isolation makes this correct; the singleton can't show N
// states in one grid, hence cardMode "single" for store-driven components.
function storeDecorator(inner: any, ctx: any) {
  useStore.getState().reset();
  const ss = ctx && ctx.parameters && ctx.parameters.storeState;
  if (ss) useStore.setState(ss);
  return inner();
}

function compose(S: any, key: string) {
  const meta: any = S.default ?? {};
  const st: any = S[key];
  const args: any = { ...(meta.args ?? {}), ...(st && st.args ? st.args : {}) };
  const at: any = { ...(meta.argTypes ?? {}), ...(st && st.argTypes ? st.argTypes : {}) };
  for (const k of Object.keys(args)) {
    const m = at[k] && at[k].mapping;
    if (m && typeof m === 'object' && args[k] in m) args[k] = m[args[k]];
  }
  const title: string = typeof meta.title === 'string' ? meta.title : '';
  const ctx: any = {
    args, name: key, title, kind: title, id: '', componentId: '',
    globals: {}, viewMode: 'story',
    parameters: (st && st.parameters) ?? meta.parameters ?? {},
  };
  let render: (() => any) | null = null;
  if (st && typeof st.render === 'function') render = () => st.render(args, ctx);
  else if (typeof st === 'function') render = () => st(args, ctx);
  else if (typeof meta.render === 'function') render = () => meta.render(args, ctx);
  else {
    const C = (st && st.component) || meta.component;
    if (C) render = () => React.createElement(C, args);
  }
  if (!render) return () => null;
  const decorators: any[] = ([] as any[])
    .concat((st && st.decorators) ?? [])
    .concat(meta.decorators ?? [])
    .concat(storeDecorator);
  return decorators.reduce((inner: any, dec: any) => () => {
    const out = dec(inner, ctx);
    return out === undefined ? inner() : out;
  }, render);
}

${exportLines}
`;

for (const [name, storyPath, keys] of comps) {
  const exportLines = keys.map((k) => `export const ${k} = compose(S, ${JSON.stringify(k)});`).join('\n');
  writeFileSync(join(outDir, `${name}.tsx`), tpl(storyPath, exportLines));
  console.log('wrote', name, `(${keys.length} stories)`);
}

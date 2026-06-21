# design-sync notes — Video Trimmer UI

## IDE resolution for owned previews (2026-06-21)
- `.design-sync/tsconfig.json` added (IDE-only). The owned previews import the
  converter-internal `@ds-stories/*` alias, which only the converter resolves at
  bundle time; the editor's TS service flagged `cannot find module
  '@ds-stories/...'` (red line, e.g. on `previews/DownloadButton.tsx`). The new
  tsconfig maps `@ds-stories/*`→repo root (+ `@/*`) so the IDE resolves it.
- Does NOT alias `video.js`/`wavesurfer.js` to mocks (the bundle tsconfig does
  that for runtime) — the IDE wants the REAL types, matching root tsconfig.
- Includes `../next-env.d.ts` so node types (NodeJS namespace) load, else
  transitively-imported `usePlayheadSeek.ts` fails. `tsc -p .design-sync/
  tsconfig.json --noEmit` = 0 errors; app `npm run type-check` unaffected
  (root's `**` glob skips dot-dirs, so `.design-sync` is never in the app build).
- Pure tooling fix — touches no synced component, so no Claude Design re-push.


This repo is a **Next.js app**, not a packaged design system. There is no
component `dist/`. design-sync runs in **storybook shape** against a synthetic
barrel that exposes the app's storied UI components as the DS bundle.

## Player modularization (2026-06-21)
- video.js native control bar (`controls: true`) was replaced with custom React
  controls (`controls: false` in `VideoPlayerView.tsx`). New modular components
  under `src/features/player/components/`, all pure-prop presentational (sync
  clean, no owned preview): `PlayButton`, `TimeDisplay`, `Scrubber`,
  `QualitySelector`, `FullscreenButton`, `VolumeControl`, `PlayerControls`
  (layout), `VideoScreenPlaceholder` (design stand-in for the mocked video).
- Containers (NOT synced): `PlayerControlBar` (wires controls to store+context+
  hooks), `VideoScreen` (video.js mount frame; lifecycle still owned by
  `VideoPlayerView`). New hooks: `useQualityLevels` (ported from the deleted
  `qualityMenuButton.ts`), `useFullscreen` (wrapper-div fullscreen).
- Icons are inline SVG (video.js icon font is excluded from storybook/Claude
  Design CSS, so `vjs-icon-*` glyphs would be blank there).
- `config.json` overrides: `PlayerControls`/`Scrubber`/`VideoScreenPlaceholder`
  = `cardMode: "column"` (wide).

## Off-envelope setup (why these files exist)
- `.design-sync/entry.ts` — synthetic barrel: re-exports the 15 storied
  components + `VideoPlayerProvider`/`useVideoPlayerContext`/`useStore` so the
  converter bundles the real compiled components onto `window.VideoTrimmerUI`.
  Passed as `cfg.entry` (and `--entry`); there is no `node_modules/<pkg>`.
- `.design-sync/tsconfig.bundle.json` — bundle-only tsconfig. `baseUrl: ".."`
  (repo root). Mirrors `.storybook/main.ts` vite aliases: maps `@/*`→`src/*`,
  and `video.js`/`wavesurfer.js`→`src/__mocks__/{videojs,wavesurfer}.ts`. The
  esbuild bundle thus resolves the SAME mocks Storybook renders with — without
  this, the bundle would pull real video.js/wavesurfer and diverge from the
  reference. NEVER add these mock paths to the app's tsconfig.
- `cfg.storyImports.shim` forces `VideoPlayerContext` and `useStore` onto the
  global. Their filenames don't match their export names, so rule-2 filename
  redirect doesn't fire on its own; the shim keeps React-context and
  Zustand-store identity shared between story decorators and bundled components.

## Known watch points (verify empirically in solo phase)
- **Zustand store singleton**: 12/15 stories inject `parameters.storeState` via
  the global `.storybook/preview.tsx` decorator (`useStore.reset()` +
  `setState`). If the bundled decorator gets its OWN `useStore` copy (separate
  from the components'), store-driven components render blank vs populated
  storybook. The shim above is the intended fix; CONFIRM on a store-driven
  component first (Playhead / TimelineEditor). Fallback: owned previews calling
  `window.VideoTrimmerUI.useStore.setState({...})` per story.
- **Mock shells**: VideoPlayerView (video.js) and WaveformBackground
  (wavesurfer) render mock placeholders, not live media. Honest for design use;
  surface to the user.
- **Tailwind v4**: styles come from `.storybook/storybook.css` (`@import
  "tailwindcss"`) via `@tailwindcss/postcss`. Confirm sb-reference renders
  STYLED before grading (else unstyled-vs-unstyled false pass).

## Store injection — SOLVED via owned previews
- 12 store-driven components have owned previews in `.design-sync/previews/`
  that append an outermost `storeDecorator` mirroring `.storybook/preview.tsx`
  (`useStore.getState().reset()` + `setState(ctx.parameters.storeState)`,
  synchronous during render). VERIFIED on Playhead: per-story positions inject
  correctly. `useStore` resolves to the global singleton via cfg.storyImports.shim.
- The converter's global preview-decorator path (`__dsDecorate`) uses a FIXED
  empty-parameters ctx, so it can't inject per-story storeState — owned previews
  are the only mechanism. (Decorator bundle also fails on `@import "tailwindcss"`
  in storybook.css — irrelevant, we don't use it.)
- These 12 are `cardMode: "single"` (+ primaryStory): a Zustand singleton can't
  show N states in one grid/column, so the product card shows ONE canonical
  populated state. All stories are still graded individually via ?story=.
- `TimelineControls` is `cardMode: "column"` (wide, non-store).
- Owned previews regenerated by `.design-sync/gen-previews.mjs` (one-off helper;
  Playhead.tsx is the hand-authored reference). Editing a story's exports/keys
  means updating the matching previews/<Name>.tsx.
- `[RENDER_BLANK]` warnings on Playhead/TrimHandle are BENIGN — both are thin
  line/handle elements; PNG is small because content is sparse. Verified renders.

## Dark background — REQUIRED for fidelity
- The card template (emit.mjs, un-forkable) hardcodes `body{background:#fff}`.
  Components are designed for the app's dark `#101114`; several use `text-white`
  / `bg-white/10` / light borders that VANISH on white (UploadZone drop area,
  PreviewButtons "Preview First & Last 5s" center, UrlInputZone).
- Fix: `.design-sync/preview-overrides.css` (committed) carries `!important`
  body/.ds-cell dark rules — a linked stylesheet's !important beats emit's
  non-important inline rule. It is CONCATENATED onto the Vite CSS to build
  cssEntry. This matches Storybook's dark canvas (backgrounds addon #101114).

## VideoPlayerView — skipped (broken in repo's own storybook)
- Both stories `sb-error`: "Class extends value undefined". The video.js mock
  (`src/__mocks__/videojs.ts`) lacks `getComponent`/`registerComponent`, so a
  module-scope `class extends videojs.getComponent(...)` (qualityMenuButton /
  player lib) throws on render in BOTH storybook and the bundle. Pre-existing,
  not introduced here. `cfg.overrides.VideoPlayerView.skip` excludes both
  stories. Component stays in the bundle (window.VideoTrimmerUI.VideoPlayerView)
  but has no verified card. To include it, the repo must complete its video.js
  mock so the storybook story renders.

## Re-sync risks
- `cssEntry` = `.design-sync/sb-reference/compiled.css`, BUILT each sync by:
    `cat $(ls -S sb-reference/assets/*.css | head -1) .design-sync/preview-overrides.css > sb-reference/compiled.css`
  sb-reference is gitignored & rebuilt per sync, so RE-DO this concat after every
  `storybook build`, before the converter, else cssEntry is stale or loses the
  dark-bg overrides.
- Owned previews are tied to the story files' export names + parameters.storeState
  shape. If a story's storeState fields change (e.g. store schema migration),
  the owned preview still injects the old shape — re-verify store-driven
  components after any `useStore` schema change.
- video.js / wavesurfer mock shells: VideoPlayerView + WaveformBackground render
  placeholders, not live media (bundle aliases to src/__mocks__ via the bundle
  tsconfig). Intentional.
- Reference must be rebuilt (`storybook build`) whenever component source or
  stories change, or grades compare against stale design.

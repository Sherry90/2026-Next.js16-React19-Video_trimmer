/**
 * video.js 컨트롤바용 화질 선택 메뉴 (톱니바퀴 아이콘).
 *
 * `videojs-contrib-quality-levels`가 노출하는 `player.qualityLevels()`를 열거해 `Auto + height`
 * 메뉴를 만들고, 선택 시 해당 레벨만 `enabled`로 두어 화질을 고정한다(Auto = 전부 enabled = ABR).
 * 기본값은 1080p(없으면 최고)이며, 선택값은 `onSelect(height|null)`로 외부(store)에 전달돼
 * 최종 다운로드 화질과 일치시킨다.
 *
 * 기존 React 오버레이(QualitySelector) 로직을 네이티브 video.js 컴포넌트로 포팅한 것.
 */

import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

// 동적 컴포넌트 확장 — 베이스는 런타임 등록 클래스라 any로 받는다.
/* eslint-disable @typescript-eslint/no-explicit-any */
const VjsMenuButton = videojs.getComponent('MenuButton') as any;
const VjsMenuItem = videojs.getComponent('MenuItem') as any;

type QualityValue = number | 'auto';
export type OnQualitySelect = (height: number | null) => void;

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

class QualityMenuItem extends VjsMenuItem {
  value: QualityValue;
  private onSelect_: (v: QualityValue) => void;

  constructor(
    player: Player,
    options: { label: string; value: QualityValue; selected: boolean; onSelect: (v: QualityValue) => void }
  ) {
    super(player, { label: options.label, selectable: true, selected: options.selected });
    this.value = options.value;
    this.onSelect_ = options.onSelect;
  }

  handleClick() {
    this.onSelect_(this.value);
  }
}

class QualityMenuButton extends VjsMenuButton {
  private ql_: QualityLevelList | null = null;
  private current_: QualityValue = 'auto';
  private onSelect_: OnQualitySelect = () => {};
  // 사용자가 직접 고르기 전까지는 레벨이 채워질 때마다 기본 화질을 재적용한다.
  // (VHS가 레벨을 점진 추가하므로 첫 이벤트에 고정하면 144p 등에 잘못 묶임.)
  private userChose_ = false;
  private refresh_: () => void = () => {};

  constructor(player: Player, options: { onSelect: OnQualitySelect }) {
    super(player, options);
    this.onSelect_ = options.onSelect;
    this.controlText('화질');
    this.addClass('vjs-quality-menu-button');

    // 톱니 아이콘: MenuButton의 아이콘 placeholder에 글리프 클래스 부여
    const placeholder = (this as any).menuButton_?.el()?.querySelector('.vjs-icon-placeholder');
    if (placeholder) placeholder.classList.add('vjs-icon-cog');
    else this.addClass('vjs-icon-cog');

    const p = player as unknown as { qualityLevels?: () => QualityLevelList };
    this.ql_ = p.qualityLevels ? p.qualityLevels() : null;

    this.refresh_ = () => {
      if (!this.userChose_) this.applyTarget_();
      this.update(); // createItems() 재호출 → 메뉴 재구성
      this.updateVisibility_();
    };
    if (this.ql_) {
      this.ql_.on('addqualitylevel', this.refresh_);
      this.ql_.on('change', this.refresh_);
    }
    this.updateVisibility_();
  }

  buildCSSClass() {
    return `vjs-quality-menu-button ${super.buildCSSClass()}`;
  }

  private heights_(): number[] {
    const ql = this.ql_;
    if (!ql) return [];
    return [
      ...new Set(
        Array.from({ length: ql.length }, (_, i) => ql[i].height).filter(
          (h): h is number => typeof h === 'number' && h > 0
        )
      ),
    ].sort((a, b) => b - a);
  }

  // MenuButton이 메뉴 구성 시 호출 (생성자 super() 중에도 1회 호출됨 → 빈 배열 안전)
  createItems() {
    const heights = this.heights_();
    if (heights.length === 0) return [];
    // 사용자가 직접 고른 선택 — 이후 자동 재적용 중단
    const onSelect = (v: QualityValue) => {
      this.userChose_ = true;
      this.applySelection_(v);
    };
    const player = this.player();
    const items = [
      new QualityMenuItem(player, { label: 'Auto', value: 'auto', selected: this.current_ === 'auto', onSelect }),
    ];
    for (const h of heights) {
      items.push(new QualityMenuItem(player, { label: `${h}p`, value: h, selected: this.current_ === h, onSelect }));
    }
    return items;
  }

  private applySelection_(v: QualityValue) {
    const ql = this.ql_;
    if (ql) {
      for (let i = 0; i < ql.length; i++) {
        ql[i].enabled = v === 'auto' ? true : ql[i].height === v;
      }
    }
    this.current_ = v;
    this.onSelect_(v === 'auto' ? null : v);
    this.update(); // 체크 표시 갱신
  }

  // 기본 화질: 1080p, 없으면 현재까지의 최고. 레벨이 점진 추가되므로 사용자 선택 전까지 매번 재평가.
  private applyTarget_() {
    const heights = this.heights_();
    if (heights.length === 0) return;
    const target = heights.includes(DEFAULT_TARGET) ? DEFAULT_TARGET : heights[0];
    if (target !== this.current_) this.applySelection_(target);
  }

  // 화질이 2개 이상일 때만 노출 (파일 소스/단일 화질은 레벨이 비어 숨김)
  private updateVisibility_() {
    if (this.heights_().length <= 1) this.hide();
    else this.show();
  }

  dispose() {
    if (this.ql_) {
      this.ql_.off('addqualitylevel', this.refresh_);
      this.ql_.off('change', this.refresh_);
    }
    super.dispose();
  }
}

let registered = false;

/**
 * 플레이어 컨트롤바에 화질 메뉴(톱니)를 fullscreen 토글 앞에 추가한다.
 * @param onSelect 선택된 height(px) 또는 null(Auto)을 받는 콜백 — store 동기화용.
 */
export function setupQualityMenu(player: Player, onSelect: OnQualitySelect) {
  if (!registered) {
    videojs.registerComponent('QualityMenuItem', QualityMenuItem as any);
    videojs.registerComponent('QualityMenuButton', QualityMenuButton as any);
    registered = true;
  }

  const controlBar = (player as any).controlBar;
  if (!controlBar) return;

  const children = controlBar.children();
  const fsIndex = children.findIndex((c: any) => c?.name?.() === 'FullscreenToggle');
  const index = fsIndex >= 0 ? fsIndex : children.length;

  controlBar.addChild('QualityMenuButton', { onSelect }, index);
}

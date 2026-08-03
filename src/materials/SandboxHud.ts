/**
 * Composite XR action panel: exhibit strip + paginated params (materials or fire).
 */
import { Group, type Object3D } from 'three/webgpu';
import type { ActionPanel } from '../xr/ImmersiveMode';
import type { GizmoMode } from '../sim/obstacles';
import type { KoraParams } from '../sim/params';
import { MaterialPanel, type MaterialAction, type SandboxExhibit } from './MaterialPanel';
import { WorldParamsPanel } from './WorldParamsPanel';
import { FireParamsPanel } from './FireParamsPanel';
import type { MaterialKind } from './MlsMpm';
import type { MaterialsParams } from './params';

export class SandboxHud implements ActionPanel {
  readonly group = new Group();
  readonly materials: MaterialPanel;
  readonly params: WorldParamsPanel;
  private fireParams: FireParamsPanel | null = null;
  private exhibit: SandboxExhibit;
  private paramsChangeHandler: (() => void) | null = null;

  constructor(params: MaterialsParams, exhibit: SandboxExhibit = 'sand') {
    this.exhibit = exhibit;
    this.materials = new MaterialPanel(exhibit === 'fire' ? 'sand' : exhibit);
    this.params = new WorldParamsPanel(params);
    this.group.add(this.materials.group);
    this.group.add(this.params.group);
    this.materials.setKind(exhibit);
    this.syncParamsVisibility();
  }

  /**
   * Bind the fire exhibit's live params once it exists. Same placement / paging as the MPM panel.
   */
  bindFire(
    getParams: () => KoraParams,
    onGizmoMode: (mode: GizmoMode) => void,
  ): void {
    if (this.fireParams) {
      this.group.remove(this.fireParams.group);
      this.fireParams.dispose();
    }
    this.fireParams = new FireParamsPanel(getParams, onGizmoMode);
    if (this.paramsChangeHandler) this.fireParams.setOnChange(this.paramsChangeHandler);
    this.group.add(this.fireParams.group);
    this.syncParamsVisibility();
  }

  get targets(): Object3D[] {
    const fire = this.fireParams?.visible ? this.fireParams.targets : [];
    const mpm = this.params.visible ? this.params.targets : [];
    return [...this.materials.targets, ...mpm, ...fire];
  }

  get visible(): boolean {
    return this.group.visible;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    this.materials.setVisible(visible);
    this.syncParamsVisibility();
  }

  setOnAction(handler: (action: MaterialAction) => void): void {
    this.materials.setOnAction(handler);
  }

  setOnParamsChange(handler: () => void): void {
    this.paramsChangeHandler = handler;
    this.params.setOnChange(handler);
    this.fireParams?.setOnChange(handler);
  }

  setExhibit(exhibit: SandboxExhibit): void {
    this.exhibit = exhibit;
    this.materials.setKind(exhibit);
    if (exhibit !== 'fire') this.params.setKind(exhibit);
    this.syncParamsVisibility();
  }

  setMaterialKind(kind: MaterialKind): void {
    this.exhibit = kind;
    this.materials.setKind(kind);
    this.params.setKind(kind);
    this.syncParamsVisibility();
  }

  handlePick(object: Object3D): boolean {
    if (this.materials.handlePick(object)) return true;
    if (this.params.visible && this.params.handlePick(object)) return true;
    if (this.fireParams?.visible && this.fireParams.handlePick(object)) return true;
    return false;
  }

  refreshParams(): void {
    this.params.refresh();
    this.fireParams?.refresh();
  }

  private syncParamsVisibility(): void {
    const show = this.group.visible;
    const fire = this.exhibit === 'fire';
    this.params.setVisible(show && !fire);
    this.fireParams?.setVisible(show && fire);
  }

  dispose(): void {
    this.materials.dispose();
    this.params.dispose();
    this.fireParams?.dispose();
  }
}

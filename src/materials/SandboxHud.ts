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
import { AvbdScenePanel } from './AvbdScenePanel';
import { EnvPanel } from './EnvPanel';
import type { EnvironmentName } from '../scene/Environment';
import type { StackPreset } from './webphysics/presets';
import type { MaterialKind } from './MlsMpm';
import type { MaterialsParams } from './params';

export class SandboxHud implements ActionPanel {
  readonly group = new Group();
  readonly materials: MaterialPanel;
  readonly params: WorldParamsPanel;
  readonly env = new EnvPanel();
  private fireParams: FireParamsPanel | null = null;
  private avbdScenes: AvbdScenePanel | null = null;
  private exhibit: SandboxExhibit;
  private paramsChangeHandler: (() => void) | null = null;

  constructor(params: MaterialsParams, exhibit: SandboxExhibit = 'sand') {
    this.exhibit = exhibit;
    this.materials = new MaterialPanel(exhibit === 'fire' ? 'sand' : exhibit);
    this.params = new WorldParamsPanel(params);
    this.group.add(this.materials.group);
    this.group.add(this.params.group);
    this.group.add(this.env.group);
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

  /** GPU AVBD only — the CPU exhibit runs its own scene ids and has no desktop picker either. */
  bindAvbdScenes(onSelect: (id: StackPreset) => void): void {
    if (this.avbdScenes) {
      this.group.remove(this.avbdScenes.group);
      this.avbdScenes.dispose();
    }
    this.avbdScenes = new AvbdScenePanel();
    this.avbdScenes.setOnSelect(onSelect);
    this.group.add(this.avbdScenes.group);
    this.syncParamsVisibility();
  }

  setAvbdScene(id: StackPreset): void {
    this.avbdScenes?.setScene(id);
  }

  get targets(): Object3D[] {
    const fire = this.fireParams?.visible ? this.fireParams.targets : [];
    const mpm = this.params.visible ? this.params.targets : [];
    const avbd = this.avbdScenes?.visible ? this.avbdScenes.targets : [];
    const env = this.env.visible ? this.env.targets : [];
    return [...this.materials.targets, ...mpm, ...fire, ...avbd, ...env];
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

  setOnEnvironment(handler: (name: EnvironmentName) => void): void {
    this.env.setOnSelect(handler);
  }

  setEnvironment(name: EnvironmentName): void {
    this.env.setEnvironment(name);
  }

  setOnParamsChange(handler: () => void): void {
    this.paramsChangeHandler = handler;
    this.params.setOnChange(handler);
    this.fireParams?.setOnChange(handler);
  }

  setExhibit(exhibit: SandboxExhibit): void {
    this.exhibit = exhibit;
    this.materials.setKind(exhibit);
    if (exhibit !== 'fire' && exhibit !== 'avbd') this.params.setKind(exhibit);
    this.syncParamsVisibility();
  }

  setGelSurface(on: boolean): void {
    this.materials.setGelSurface(on);
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
    if (this.avbdScenes?.visible && this.avbdScenes.handlePick(object)) return true;
    if (this.env.visible && this.env.handlePick(object)) return true;
    return false;
  }

  refreshParams(): void {
    this.params.refresh();
    this.fireParams?.refresh();
  }

  private syncParamsVisibility(): void {
    const show = this.group.visible;
    const fire = this.exhibit === 'fire';
    const avbd = this.exhibit === 'avbd';
    const mpm = !fire && !avbd;
    this.env.setVisible(show);
    this.params.setVisible(show && mpm);
    this.fireParams?.setVisible(show && fire);
    this.avbdScenes?.setVisible(show && avbd);
  }

  dispose(): void {
    this.materials.dispose();
    this.params.dispose();
    this.env.dispose();
    this.fireParams?.dispose();
    this.avbdScenes?.dispose();
  }
}

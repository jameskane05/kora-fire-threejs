/**
 * Desktop control panel for MLS-MPM sandbox exhibits — grouped like the fire GUI.
 */
import GUI from 'lil-gui';
import type { GizmoMode } from '../sim/obstacles';
import type { MaterialKind } from './MlsMpm';
import type { MaterialsParams } from './params';
import type { ForceColliderKind } from './ForceColliders';

export interface MaterialsGuiCallbacks {
  onReset(): void;
  onMaterial(kind: MaterialKind): void;
  /** Params mutated in place; called after any live knob change. */
  onChange(): void;
  onAddCollider(kind: ForceColliderKind): void;
  onRemoveCollider(): void;
  onGizmoMode(mode: GizmoMode): void;
}

function tip<T extends { domElement: HTMLElement }>(controller: T, text: string): T {
  controller.domElement.title = text;
  return controller;
}

export function createMaterialsGui(
  params: MaterialsParams,
  kind: MaterialKind,
  cb: MaterialsGuiCallbacks,
): GUI {
  const gui = new GUI({ title: 'Materials', width: 300 });
  gui.$title.title = 'MLS-MPM sandbox knobs. Hover a row for a short note.';

  const state = { material: kind };
  const actions = { reset: () => cb.onReset() };

  const materialCtrl = tip(
    gui
      .add(state, 'material', ['sand', 'goo', 'water'] as MaterialKind[])
      .name('material')
      .onChange((k: MaterialKind) => {
        cb.onMaterial(k);
        rebuildFolders();
      }),
    'Active MPM exhibit. Fire is switched from the toolbar / XR strip.',
  );
  tip(gui.add(actions, 'reset').name('reset'), 'Re-seed particles for the active material.');

  tip(
    gui
      .add(params, 'gravity', 10, 250, 1)
      .name('gravity')
      .onChange(() => cb.onChange()),
    'Baseline downward acceleration (sim units). Per-material scale multiplies this.',
  );
  tip(
    gui
      .add(params, 'handForce', 5, 120, 1)
      .name('collider / hand force')
      .onChange(() => cb.onChange()),
    'Baseline impulse for desktop force colliders and XR hand bones. Per-material scale multiplies this.',
  );

  const colliders = gui.addFolder('Force colliders (desktop)');
  const shapes = {
    sphere: () => cb.onAddCollider('sphere'),
    box: () => cb.onAddCollider('box'),
    remove: () => cb.onRemoveCollider(),
  };
  const gizmoState = { mode: 'translate' as GizmoMode };
  tip(colliders.add(shapes, 'sphere').name('add sphere'), 'Drop a sphere force field you can drag with the gizmo.');
  tip(colliders.add(shapes, 'box').name('add box'), 'Drop an oriented box force field.');
  tip(colliders.add(shapes, 'remove').name('remove selected'), 'Remove the gizmo-selected collider.');
  tip(
    colliders
      .add(gizmoState, 'mode', ['translate', 'rotate', 'scale'] as GizmoMode[])
      .name('gizmo (W / E / R)')
      .onChange((m: GizmoMode) => cb.onGizmoMode(m)),
    'Same TransformControls modes as the fire demo. W translate, E rotate, R scale, Esc clears selection.',
  );
  colliders.open();

  const sim = gui.addFolder('Time stepping');
  tip(
    sim
      .add(params, 'substeps', 4, 24, 1)
      .name('substeps / frame')
      .onChange(() => cb.onChange()),
    'More substeps = stabler / heavier. XR may override with a lighter count while presenting.',
  );
  tip(
    sim
      .add(params, 'subDt', 1e-4, 5e-4, 1e-5)
      .name('Δt per substep')
      .onChange(() => cb.onChange()),
    'Fixed substep size. Raising this with low substeps can detonate elastic materials.',
  );

  let matFolder: GUI | null = null;

  const rebuildFolders = () => {
    if (matFolder) {
      matFolder.destroy();
      matFolder = null;
    }
    const k = state.material;
    const t = params[k];
    matFolder = gui.addFolder(`${k} body`);
    tip(
      matFolder
        .add(t, 'gravityScale', 0.2, 4, 0.05)
        .name('gravity ×')
        .onChange(() => cb.onChange()),
      'Multiplies baseline gravity for this material.',
    );
    tip(
      matFolder
        .add(t, 'handForceScale', 0.2, 8, 0.05)
        .name('hand force ×')
        .onChange(() => cb.onChange()),
      'Multiplies baseline poke for this material.',
    );
    tip(
      matFolder
        .add(t, 'mu', 0, 400, 1)
        .name('μ shear')
        .onChange(() => cb.onChange()),
      'Neo-Hookean shear stiffness. Water should stay 0 (pressure-only).',
    );
    tip(
      matFolder
        .add(t, 'lambda', 20, 1200, 5)
        .name('λ volume')
        .onChange(() => cb.onChange()),
      'Volume stiffness. Water uses this as weakly-compressible bulk modulus.',
    );
    matFolder.open();
  };

  rebuildFolders();

  return Object.assign(gui, {
    setMaterial(k: MaterialKind) {
      state.material = k;
      materialCtrl.updateDisplay();
      rebuildFolders();
    },
    refresh() {
      materialCtrl.updateDisplay();
      for (const c of gui.controllers) c.updateDisplay();
      for (const f of gui.folders) {
        for (const c of f.controllers) c.updateDisplay();
      }
    },
  });
}

export type MaterialsGui = ReturnType<typeof createMaterialsGui>;

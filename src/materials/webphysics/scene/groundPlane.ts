import * as THREE from 'three';

export function createGroundPlane(): THREE.Group {
  const group = new THREE.Group();

  const geometry = new THREE.PlaneGeometry(100, 100);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x333344,
    roughness: 0.8,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  group.add(mesh);

  const grid = new THREE.GridHelper(100, 100, 0x555577, 0x444466);
  grid.position.y = 0.001;
  group.add(grid);

  return group;
}

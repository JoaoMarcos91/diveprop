// Modelo visual do drone (aparece na câmera em terceira pessoa / linha de visada).
import * as THREE from 'three';

export function createDroneModel(armLength) {
  const g = new THREE.Group();
  const s = armLength / 0.11; // escala relativa a um 5"
  const carbon = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.45, metalness: 0.3 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.3, metalness: 0.9 });
  const bellMat = new THREE.MeshStandardMaterial({ color: 0xd2321e, roughness: 0.35, metalness: 0.6 });
  const battMat = new THREE.MeshStandardMaterial({ color: 0x2b6fd6, roughness: 0.6 });
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const camMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.2 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0a0a20, roughness: 0.05, metalness: 0.8 });
  const propMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4, transparent: true, opacity: 0.9 });
  const discMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });

  // Placa central
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.006 * s, 0.11 * s), carbon);
  g.add(plate);
  const top = plate.clone(); top.position.y = 0.03 * s; g.add(top);
  // Braços em X
  const d = armLength * Math.SQRT1_2;
  const props = [];
  const discs = [];
  const positions = [[d, -d], [-d, -d], [d, d], [-d, d]];
  positions.forEach(([x, z], i) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.018 * s, 0.005 * s, armLength * 1.05), carbon);
    arm.position.set(x / 2, 0, z / 2);
    arm.rotation.y = Math.atan2(x, z);
    g.add(arm);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.014 * s, 12), motorMat);
    motor.position.set(x, 0.009 * s, z);
    g.add(motor);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.0125 * s, 0.0125 * s, 0.006 * s, 12), bellMat);
    bell.position.set(x, 0.018 * s, z);
    g.add(bell);
    const prop = new THREE.Group();
    const r = 0.0635 * s;
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(r * 0.95, 0.0015 * s, 0.011 * s), propMat);
      blade.position.x = r * 0.5;
      const holder = new THREE.Group();
      holder.rotation.y = (k / 3) * Math.PI * 2;
      blade.rotation.x = 0.25 * (i % 3 === 0 ? 1 : -1);
      holder.add(blade);
      prop.add(holder);
    }
    prop.position.set(x, 0.023 * s, z);
    g.add(prop);
    props.push(prop);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.023 * s, z);
    disc.visible = false;
    g.add(disc);
    discs.push(disc);
  });
  // Bateria + strap
  const batt = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.03 * s, 0.075 * s), battMat);
  batt.position.y = 0.05 * s;
  g.add(batt);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.037 * s, 0.032 * s, 0.012 * s), strapMat);
  strap.position.y = 0.05 * s;
  g.add(strap);
  // Câmera FPV inclinada
  const cam = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.019 * s, 0.019 * s, 0.02 * s), camMat);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.007 * s, 0.007 * s, 0.01 * s, 12), lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.013 * s;
  cam.add(body, lens);
  cam.position.set(0, 0.016 * s, -0.045 * s);
  g.add(cam);
  // Antena
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0015 * s, 0.0015 * s, 0.05 * s, 6), strapMat);
  ant.position.set(0, 0.04 * s, 0.07 * s);
  ant.rotation.x = 0.6;
  g.add(ant);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  discs.forEach(dm => { dm.castShadow = false; });

  g.userData = { props, discs, cam };
  return g;
}

export function animateDroneModel(model, motors, dt) {
  const { props, discs } = model.userData;
  for (let i = 0; i < 4; i++) {
    const s = motors[i];
    const dir = i === 0 || i === 3 ? 1 : -1;
    props[i].rotation.y += dir * Math.min(s * 900, 40) * dt;
    const fast = s > 0.12;
    discs[i].visible = fast;
    props[i].visible = !fast || s < 0.2;
  }
}

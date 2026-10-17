// Câmeras: FPV (com uptilt), terceira pessoa e linha de visada.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const _q = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _fw = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

export class CameraRig {
  constructor(camera, settings) {
    this.camera = camera;
    this.settings = settings;
    this.chasePos = new THREE.Vector3();
    this.shake = new THREE.Vector3();
    this.initialized = false;
  }

  reset() { this.initialized = false; }

  update(dt, drone, model, heightAt, pilotPos, aspect) {
    const c = this.settings.data.camera;
    const cam = this.camera;
    const pos = drone.position(_p);
    const q = drone.quaternion(_q);
    const s = drone.p.armLength / 0.11;
    let vfov;

    if (c.mode === 'fpv') {
      model.visible = false;
      _v.set(0, 0.02 * s, -0.05 * s).applyQuaternion(q);
      cam.position.copy(pos).add(_v);
      _tilt.setFromAxisAngle(X, c.uptilt * DEG);
      cam.quaternion.copy(q).multiply(_tilt);
      // vibração (motores + propwash)
      const amp = c.shake * (0.0012 * drone.avgMotor() + 0.01 * drone.propwashLevel);
      if (amp > 0) {
        const k = 1 - Math.exp(-dt * 60);
        this.shake.x += ((Math.random() - 0.5) * amp - this.shake.x) * k;
        this.shake.y += ((Math.random() - 0.5) * amp - this.shake.y) * k;
        cam.rotateX(this.shake.x);
        cam.rotateY(this.shake.y);
      }
      const h = Math.min(c.fov, 175) * DEG;
      vfov = 2 * Math.atan(Math.tan(h / 2) / aspect) / DEG;
      cam.near = 0.04;
    } else if (c.mode === 'chase') {
      model.visible = true;
      _fw.set(0, 0, -1).applyQuaternion(q);
      _fw.y = 0;
      if (_fw.lengthSq() < 1e-4) _fw.set(0, 0, -1);
      _fw.normalize();
      const target = _v.copy(pos).addScaledVector(_fw, -c.chaseDist).addScaledVector(Y, c.chaseHeight);
      if (!this.initialized) this.chasePos.copy(target);
      this.chasePos.lerp(target, 1 - Math.exp(-dt * c.chaseSmooth));
      const ground = heightAt(this.chasePos.x, this.chasePos.z) + 0.3;
      if (this.chasePos.y < ground) this.chasePos.y = ground;
      cam.position.copy(this.chasePos);
      cam.up.set(0, 1, 0);
      cam.lookAt(pos.x, pos.y + 0.15, pos.z);
      vfov = 70;
      cam.near = 0.05;
    } else {
      model.visible = true;
      cam.position.set(pilotPos.x, heightAt(pilotPos.x, pilotPos.z) + c.losHeight, pilotPos.z);
      cam.up.set(0, 1, 0);
      cam.lookAt(pos);
      const dist = cam.position.distanceTo(pos);
      vfov = c.losZoom ? THREE.MathUtils.clamp(2 * Math.atan(3.5 / Math.max(dist, 0.1)) / DEG, 6, 70) : 60;
      cam.near = 0.1;
    }
    this.initialized = true;
    const viewDist = this.settings.data.graphics.viewDistance;
    cam.far = viewDist * 1.6 + 200;
    if (Math.abs(cam.fov - vfov) > 0.01 || cam.aspect !== aspect) {
      cam.fov = vfov;
      cam.aspect = aspect;
    }
    cam.updateProjectionMatrix();
  }
}

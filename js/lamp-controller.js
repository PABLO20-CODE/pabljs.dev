import * as THREE from "https://unpkg.com/three@0.169.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import gsap from "https://unpkg.com/gsap@3.12.5/index.js";

export function initLampGuide(options = {}) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.innerWidth < 768;

  const canvas = document.createElement("canvas");
  canvas.id = "lamp-3d-canvas";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "45",
    pointerEvents: "none",
    opacity: "0.92"
  });
  document.body.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !isMobile;
  if (!isMobile) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2.1, isMobile ? 7.8 : 6.4);
  camera.lookAt(0, 1.1, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.24);
  scene.add(ambient);

  const spotLight = new THREE.SpotLight(
    0xfff1d0,
    isMobile ? 20 : 28,
    18,
    Math.PI / 5,
    0.55,
    1.35
  );
  spotLight.position.set(0, 2.4, 0.5);
  if (!isMobile) {
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.set(1024, 1024);
  }

  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(0, 0.2, 2.5);
  scene.add(spotLight, spotLight.target, lightTarget);
  spotLight.target = lightTarget;

  const beamGeo = new THREE.ConeGeometry(1.3, 3.5, isMobile ? 16 : 28, 1, true);
  beamGeo.translate(0, -1.75, 0);
  beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff1d0,
    transparent: true,
    opacity: isMobile ? 0.05 : 0.085,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  scene.add(beamMesh);

  const lampRoot = new THREE.Group();
  lampRoot.position.set(isMobile ? 0.9 : 1.5, 0, 0);
  scene.add(lampRoot);

  let lowerArmPivot, upperArmPivot, headPivot, bulbTip;

  function buildFallbackLamp() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce3,
      metalness: 0.72,
      roughness: 0.28
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x22252d,
      metalness: 0.45,
      roughness: 0.58
    });

    const basePivot = new THREE.Group();
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.18, 28), darkMat);
    baseMesh.position.y = 0.09;
    baseMesh.castShadow = !isMobile;
    basePivot.add(baseMesh);
    lampRoot.add(basePivot);

    lowerArmPivot = new THREE.Group();
    lowerArmPivot.position.set(0, 0.18, 0);
    const lowerBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.25, 16), metalMat);
    lowerBar.position.y = 0.625;
    lowerBar.castShadow = !isMobile;
    lowerArmPivot.add(lowerBar);
    basePivot.add(lowerArmPivot);

    upperArmPivot = new THREE.Group();
    upperArmPivot.position.set(0, 1.25, 0);
    const upperBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.15, 16), metalMat);
    upperBar.position.y = 0.575;
    upperBar.castShadow = !isMobile;
    upperArmPivot.add(upperBar);
    lowerArmPivot.add(upperArmPivot);

    headPivot = new THREE.Group();
    headPivot.position.set(0, 1.15, 0);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.62, 24, 1, true), metalMat);
    shade.rotation.x = Math.PI / 2.4;
    shade.position.set(0, 0, 0.22);
    shade.castShadow = !isMobile;

    bulbTip = new THREE.Object3D();
    bulbTip.position.set(0, -0.05, 0.44);

    headPivot.add(shade, bulbTip);
    upperArmPivot.add(headPivot);
  }

  const loader = new GLTFLoader();
  loader.load(
    options.modelUrl || "./models/luxo-lamp.glb",
    (gltf) => {
      const model = gltf.scene;
      lampRoot.add(model);
      lowerArmPivot = model.getObjectByName("Arm_Lower_Pivot") || lampRoot;
      upperArmPivot = model.getObjectByName("Arm_Upper_Pivot") || lampRoot;
      headPivot = model.getObjectByName("Head_Pivot") || lampRoot;
      bulbTip = model.getObjectByName("Bulb_Tip") || headPivot;
    },
    undefined,
    () => buildFallbackLamp()
  );

  const pointer = { x: 0, y: 0, smoothX: 0, smoothY: 0 };
  let scrollFactor = 0;
  let isPaused = false;

  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  window.addEventListener("scroll", () => {
    const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
    scrollFactor = window.scrollY / maxScroll;
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    isPaused = document.hidden;
  });

  const MODE_STYLES = {
    inicio: { lightColor: 0xfff1d0, intensity: 28 },
    "vip-bn": { lightColor: 0xdbeafe, intensity: 34 },
    color: { lightColor: 0xffb36b, intensity: 30 },
    vip: { lightColor: 0xffcf48, intensity: 40 }
  };

  function setMode(modeName) {
    const cfg = MODE_STYLES[modeName] || MODE_STYLES.inicio;
    const targetColor = new THREE.Color(cfg.lightColor);
    const dur = prefersReducedMotion ? 0.15 : 0.65;

    gsap.to(spotLight.color, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration: dur });
    gsap.to(beamMat.color, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration: dur });
    gsap.to(spotLight, { intensity: isMobile ? cfg.intensity * 0.75 : cfg.intensity, duration: dur });

    if (prefersReducedMotion || !lowerArmPivot || !upperArmPivot || !headPivot) return;

    const tl = gsap.timeline();
    if (modeName === "inicio") {
      tl.fromTo(lampRoot.position, { y: 2.2 }, { y: 0, x: isMobile ? 0.9 : 1.5, z: 0, duration: 0.7, ease: "bounce.out" })
        .to(lampRoot.rotation, { y: 0.3, duration: 0.55 }, "<")
        .to(lowerArmPivot.rotation, { z: -0.32, duration: 0.55, ease: "back.out(1.6)" }, "<")
        .to(upperArmPivot.rotation, { z: 0.52, duration: 0.55, ease: "back.out(1.6)" }, "<");
    } else if (modeName === "vip-bn") {
      tl.to(lampRoot.position, { x: isMobile ? 1.0 : 1.65, y: 0.25, z: 0, duration: 0.35, ease: "power2.out" })
        .to(lampRoot.position, { y: 0, duration: 0.38, ease: "bounce.out" })
        .to(lampRoot.rotation, { y: 0.52, duration: 0.6 }, "<")
        .to(lowerArmPivot.rotation, { z: -0.45, duration: 0.6 }, "<")
        .to(upperArmPivot.rotation, { z: 0.68, duration: 0.6 }, "<");
    } else if (modeName === "color") {
      tl.to(lampRoot.position, { x: isMobile ? 0.7 : 1.25, y: 0.28, z: 0, duration: 0.35, ease: "power2.out" })
        .to(lampRoot.position, { y: 0, duration: 0.42, ease: "bounce.out" })
        .to(lampRoot.rotation, { y: -0.25, duration: 0.6 }, "<")
        .to(lowerArmPivot.rotation, { z: -0.24, duration: 0.6 }, "<")
        .to(upperArmPivot.rotation, { z: 0.42, duration: 0.6 }, "<");
    } else if (modeName === "vip") {
      tl.to(lampRoot.position, { x: isMobile ? 0.5 : 0.85, z: 1.35, y: 0.14, duration: 0.48, ease: "power3.out" })
        .to(headPivot.rotation, { y: 0.38, duration: 0.32, yoyo: true, repeat: 1 })
        .to(spotLight, { intensity: (isMobile ? cfg.intensity * 0.75 : cfg.intensity) * 1.3, duration: 0.2, yoyo: true, repeat: 1 });
    }
  }

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    if (isPaused) return;

    const t = clock.getElapsedTime();
    pointer.smoothX += (pointer.x - pointer.smoothX) * 0.07;
    pointer.smoothY += (pointer.y - pointer.smoothY) * 0.07;

    if (headPivot && !prefersReducedMotion) {
      headPivot.rotation.y = pointer.smoothX * 0.45;
      headPivot.rotation.x = -pointer.smoothY * 0.28 + scrollFactor * 0.22;
    }

    if (bulbTip) {
      const worldPos = new THREE.Vector3();
      bulbTip.getWorldPosition(worldPos);
      spotLight.position.copy(worldPos);
      beamMesh.position.copy(worldPos);

      const lookAtPoint = new THREE.Vector3(
        worldPos.x + pointer.smoothX * 2.0,
        Math.max(0.1, worldPos.y - 1.6 + pointer.smoothY * 0.7),
        worldPos.z + 2.5
      );
      lightTarget.position.lerp(lookAtPoint, 0.12);
      beamMesh.lookAt(lightTarget.position);
    }

    if (upperArmPivot && !prefersReducedMotion) {
      upperArmPivot.rotation.x = Math.sin(t * 1.6) * 0.022;
    }

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, { passive: true });

  setMode("inicio");
  return { setMode };
}

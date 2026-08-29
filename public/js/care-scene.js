(() => {
  const canvas = document.getElementById('careSceneCanvas');
  if (!canvas || !window.THREE) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.1, 7.1);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  scene.add(group);
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.2, 2),
    new THREE.MeshPhysicalMaterial({ color: 0x54d8c0, roughness: 0.24, metalness: 0.26, transmission: 0.08, clearcoat: 0.65, clearcoatRoughness: 0.18 })
  );
  group.add(core);

  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xb7fff0, transparent: true, opacity: 0.72 });
  const ringOne = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.012, 8, 96), ringMaterial);
  const ringTwo = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.008, 8, 96), ringMaterial.clone());
  ringTwo.material.opacity = 0.35;
  ringOne.rotation.set(0.75, 0.1, 0.25);
  ringTwo.rotation.set(1.15, -0.4, -0.2);
  group.add(ringOne, ringTwo);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.42, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x1bbda9, transparent: true, opacity: 0.08, side: THREE.BackSide })
  );
  group.add(halo);

  scene.add(new THREE.HemisphereLight(0xb8fff4, 0x08121d, 2.1));
  const keyLight = new THREE.PointLight(0x9ffff0, 4.5, 8);
  keyLight.position.set(2.5, 2.8, 3.5);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0x197b8d, 3, 7);
  rimLight.position.set(-3, -1, 2);
  scene.add(rimLight);

  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let frameId;
  const onPointerMove = (event) => {
    const bounds = canvas.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.34;
    targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.24;
  };
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });

  const resize = () => {
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 360;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize, { passive: true });
  resize();

  const animate = (time) => {
    const elapsed = time * 0.001;
    pointerX += (targetX - pointerX) * 0.035;
    pointerY += (targetY - pointerY) * 0.035;
    group.rotation.y = (reducedMotion ? 0.18 : elapsed * 0.22) + pointerX;
    group.rotation.x = pointerY + Math.sin(elapsed * 0.6) * (reducedMotion ? 0.01 : 0.045);
    group.position.y = Math.sin(elapsed * 0.8) * (reducedMotion ? 0.015 : 0.1);
    ringOne.rotation.z += reducedMotion ? 0.0003 : 0.002;
    ringTwo.rotation.x += reducedMotion ? 0.0002 : 0.001;
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(animate);
  };
  frameId = window.requestAnimationFrame(animate);

  window.addEventListener('pagehide', () => {
    window.cancelAnimationFrame(frameId);
    canvas.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('resize', resize);
    renderer.dispose();
  }, { once: true });
})();

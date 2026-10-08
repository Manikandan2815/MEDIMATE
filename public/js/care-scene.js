(() => {
  const canvas = document.getElementById('careSceneCanvas');
  if (!canvas || !window.THREE) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.2, 8.5);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Bumped up for premium look
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const group = new THREE.Group();
  scene.add(group);

  // Premium Material Definitions
  // Glossy gel-like capsule material
  const capsuleMaterial = new THREE.MeshPhysicalMaterial({ 
    color: 0x0ea5e9, 
    roughness: 0.1, 
    metalness: 0.05, 
    transmission: 0.2, 
    clearcoat: 1.0, 
    clearcoatRoughness: 0.1,
    ior: 1.5 
  });

  // Matte pristine white tablet material
  const tabletMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.6,
    metalness: 0.0,
    clearcoat: 0.0
  });

  // Create Capsule
  // If CapsuleGeometry doesn't exist (older three.js), it will throw, but assuming modern version.
  let capsule;
  try {
    capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.2, 32, 32), capsuleMaterial);
  } catch (e) {
    // Fallback to cylinder if CapsuleGeometry is missing
    capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 32), capsuleMaterial);
  }
  capsule.position.set(-0.6, 0.2, 0);
  capsule.rotation.set(0.4, 0.2, -0.5);
  group.add(capsule);

  // Create Tablet
  const tablet = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.25, 48), tabletMaterial);
  tablet.position.set(0.8, -0.4, 0.4);
  tablet.rotation.set(1.2, 0.4, 0.8);
  group.add(tablet);

  // Studio Lighting Setup (Cinematic 3-point)
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
  keyLight.position.set(5, 5, 4);
  scene.add(keyLight);
  
  const fillLight = new THREE.DirectionalLight(0xe2e8f0, 1.5);
  fillLight.position.set(-5, 0, 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x0ea5e9, 4.0); // Teal rim light
  rimLight.position.set(0, 3, -5);
  scene.add(rimLight);

  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let frameId;
  const onPointerMove = (event) => {
    const bounds = canvas.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.5;
    targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.3;
  };
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });

  const resize = () => {
    const width = canvas.clientWidth || 400;
    const height = canvas.clientHeight || 450;
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
    
    // Cinematic, slow idle rotation
    group.rotation.y = (reducedMotion ? 0 : elapsed * 0.15) + pointerX;
    group.rotation.x = pointerY + Math.sin(elapsed * 0.4) * (reducedMotion ? 0 : 0.05);
    group.position.y = Math.sin(elapsed * 0.6) * (reducedMotion ? 0 : 0.12);
    
    // Subtle individual object rotation
    capsule.rotation.y += reducedMotion ? 0 : 0.002;
    tablet.rotation.z += reducedMotion ? 0 : 0.003;

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

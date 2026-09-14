import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const EARTH_TEXTURE = "/textures/bluemarble.jpg";

export const Component = () => {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const earthRef = useRef(null);
  const starsRef = useRef(null);
  const animationRef = useRef(0);
  const scrollTarget = useRef(0);
  const smoothScroll = useRef(0);
  const previousProgress = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1a24);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    camera.position.set(0, 1.2, 13.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.42);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(-7, 4, 10);
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0x4fbbff, 0.55);
    rim.position.set(8, -2, -8);
    scene.add(rim);

    const earthGroup = new THREE.Group();
    earthGroup.position.set(0.2, 0.1, 0);
    scene.add(earthGroup);

    const earthGeometry = new THREE.SphereGeometry(2.65, 96, 96);
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(
      EARTH_TEXTURE,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      },
      undefined,
      () => {
        // Keep the globe visible even when the optional texture is unavailable.
        console.warn("[Ratnakara Landing] Earth texture not found:", EARTH_TEXTURE);
      }
    );

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      color: 0xdce9ef,
      roughness: 0.9,
      metalness: 0.02,
    });

    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.rotation.set(THREE.MathUtils.degToRad(8), THREE.MathUtils.degToRad(-24), 0);
    earthGroup.add(earth);
    earthRef.current = earthGroup;

    // Thin atmospheric shell. No cloud layer is added.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.72, 72, 72),
      new THREE.MeshBasicMaterial({
        color: 0x66c7ff,
        transparent: true,
        opacity: 0.095,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    earthGroup.add(atmosphere);

    // Very subtle night-side halo, intentionally restrained.
    const nightHalo = new THREE.Mesh(
      new THREE.SphereGeometry(2.76, 72, 72),
      new THREE.MeshBasicMaterial({
        color: 0x18364a,
        transparent: true,
        opacity: 0.035,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    earthGroup.add(nightHalo);

    // Sparse star field, hidden initially and revealed with scroll.
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const radius = 25 + Math.random() * 75;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);
    }

    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3)
    );
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.065,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    starsRef.current = stars;

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onScroll = () => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      scrollTarget.current = THREE.MathUtils.clamp(window.scrollY / maxScroll, 0, 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);

    const clock = new THREE.Clock();

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      smoothScroll.current += (scrollTarget.current - smoothScroll.current) * 0.075;
      const p = smoothScroll.current;
      setProgress(p);

      // Camera: far-away Earth -> close orbital/top-down framing.
      const cameraX = THREE.MathUtils.lerp(0.0, 1.15, THREE.MathUtils.smoothstep(p, 0.25, 1));
      const cameraY = THREE.MathUtils.lerp(1.2, 3.25, THREE.MathUtils.smoothstep(p, 0.15, 1));
      const cameraZ = THREE.MathUtils.lerp(13.5, 6.35, THREE.MathUtils.smoothstep(p, 0.0, 1));
      camera.position.x += (cameraX + pointer.x * 0.10 - camera.position.x) * 0.035;
      camera.position.y += (cameraY - pointer.y * 0.08 - camera.position.y) * 0.035;
      camera.position.z += (cameraZ - camera.position.z) * 0.045;
      camera.lookAt(0.2, 0.15, 0);

      // Earth shifts right as the camera gets closer.
      if (earthRef.current) {
        const close = THREE.MathUtils.smoothstep(p, 0.38, 1);
        const targetX = THREE.MathUtils.lerp(0.2, 1.55, close);
        const targetY = THREE.MathUtils.lerp(0.1, -0.15, close);
        earthRef.current.position.x += (targetX - earthRef.current.position.x) * 0.04;
        earthRef.current.position.y += (targetY - earthRef.current.position.y) * 0.04;

        // Gentle continuous drift + small payoff spin near the end.
        earthRef.current.rotation.y += 0.0008;
        const spinProgress = THREE.MathUtils.smoothstep(p, 0.80, 1);
        earthRef.current.rotation.z = THREE.MathUtils.lerp(0, -0.08, spinProgress);
        earthRef.current.rotation.y = earthRef.current.rotation.y + spinProgress * 0.0015;
      }

      // Day -> night: light direction and environment change with scroll.
      const night = THREE.MathUtils.smoothstep(p, 0.32, 0.92);
      sun.intensity = THREE.MathUtils.lerp(2.3, 0.52, night);
      ambient.intensity = THREE.MathUtils.lerp(0.42, 0.14, night);
      rim.intensity = THREE.MathUtils.lerp(0.55, 0.85, night);
      const bg = new THREE.Color().lerpColors(
        new THREE.Color(0x102d3e),
        new THREE.Color(0x020812),
        night
      );
      scene.background.copy(bg);
      starsMaterial.opacity = THREE.MathUtils.smoothstep(p, 0.44, 0.93) * 0.78;
      stars.rotation.y = time * 0.002;

      renderer.render(scene, camera);
      previousProgress.current = p;
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      renderer.dispose();
      earthGeometry.dispose();
      earthMaterial.dispose();
      atmosphere.geometry.dispose();
      atmosphere.material.dispose();
      nightHalo.geometry.dispose();
      nightHalo.material.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
    };
  }, []);

  const handleViewGlobe = () => {
    window.location.href = "/globe";
  };

  return (
    <div ref={rootRef} className="ratnakara-landing">
      <style>{`
        .ratnakara-landing {
          --text: #f7fbff;
          --muted: rgba(232, 243, 249, 0.70);
          --line: rgba(255,255,255,0.16);
          position: relative;
          width: 100%;
          min-height: 300vh;
          overflow-x: hidden;
          background: #020812;
          color: var(--text);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .ratnakara-landing__sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
        }
        .ratnakara-landing__canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }
        .ratnakara-landing__header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 82px;
          padding: 0 34px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
          pointer-events: none;
        }
        .ratnakara-landing__brand {
          display: flex;
          align-items: center;
          gap: 11px;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.12em;
          pointer-events: auto;
        }
        .ratnakara-landing__logo-space {
          width: 29px;
          height: 29px;
          border: 1px solid var(--line);
          border-radius: 50%;
          background: rgba(255,255,255,0.035);
          box-shadow: inset 0 0 18px rgba(255,255,255,0.035);
        }
        .ratnakara-landing__status {
          font-size: 9px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ratnakara-landing__content {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
        }
        .ratnakara-landing__hero-copy {
          position: absolute;
          left: clamp(28px, 6vw, 92px);
          top: 50%;
          transform: translateY(-50%);
          max-width: 430px;
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(.22,1,.36,1);
        }
        .ratnakara-landing__eyebrow {
          margin: 0 0 13px;
          color: rgba(239,248,252,0.54);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }
        .ratnakara-landing__title {
          margin: 0;
          font-size: clamp(42px, 6vw, 80px);
          line-height: 0.96;
          letter-spacing: -0.045em;
          font-weight: 500;
        }
        .ratnakara-landing__title strong {
          font-weight: 700;
        }
        .ratnakara-landing__subtitle {
          margin: 22px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.65;
          max-width: 330px;
        }
        .ratnakara-landing__actions {
          margin-top: 27px;
          display: flex;
          gap: 10px;
          pointer-events: auto;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 0.55s ease, transform 0.65s cubic-bezier(.22,1,.36,1);
        }
        .ratnakara-landing__actions.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .ratnakara-landing__button {
          appearance: none;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.055);
          color: #fff;
          padding: 11px 17px;
          border-radius: 999px;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          cursor: pointer;
          backdrop-filter: blur(9px);
          transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease;
        }
        .ratnakara-landing__button:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,0.10);
          border-color: rgba(255,255,255,0.33);
        }
        .ratnakara-landing__button--primary {
          background: rgba(209,236,248,0.14);
          border-color: rgba(171,222,244,0.35);
        }
        .ratnakara-landing__meta {
          position: absolute;
          left: clamp(28px, 3.4vw, 54px);
          right: clamp(28px, 3.4vw, 54px);
          bottom: 27px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          color: rgba(239,248,252,0.66);
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .ratnakara-landing__scroll {
          position: absolute;
          left: 50%;
          bottom: 25px;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: rgba(239,248,252,0.56);
          font-size: 8px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          transition: opacity 0.35s ease;
        }
        .ratnakara-landing__line {
          width: 48px;
          height: 1px;
          background: rgba(255,255,255,0.30);
          overflow: hidden;
        }
        .ratnakara-landing__line::after {
          content: "";
          display: block;
          width: 100%;
          height: 100%;
          background: #fff;
          transform: translateX(-100%);
          animation: ratnakaraLandingSweep 2.2s ease-in-out infinite;
        }
        @keyframes ratnakaraLandingSweep {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
        @media (max-width: 700px) {
          .ratnakara-landing__header { padding: 0 20px; }
          .ratnakara-landing__status { display: none; }
          .ratnakara-landing__hero-copy {
            left: 22px;
            right: 22px;
            top: auto;
            bottom: 105px;
            transform: none;
          }
          .ratnakara-landing__title { font-size: 48px; }
          .ratnakara-landing__meta { bottom: 20px; font-size: 8px; }
          .ratnakara-landing__scroll { display: none; }
        }
      `}</style>

      <div className="ratnakara-landing__sticky">
        <canvas ref={canvasRef} className="ratnakara-landing__canvas" />

        <header className="ratnakara-landing__header">
          <div className="ratnakara-landing__brand">
            <div className="ratnakara-landing__logo-space" aria-hidden="true" />
            <span>RATNAKARA</span>
          </div>
          <div className="ratnakara-landing__status">OCEAN INTELLIGENCE PLATFORM</div>
        </header>

        <div className="ratnakara-landing__content">
          <div
            className="ratnakara-landing__hero-copy"
            style={{
              opacity: progress > 0.94 ? 0.96 : 1 - progress * 0.18,
              transform: `translateY(${progress < 0.35 ? "-50%" : "-48%"})`,
            }}
          >
            <p className="ratnakara-landing__eyebrow">New Scope</p>
            <h1 className="ratnakara-landing__title">
              See the<br />
              <strong>Ocean in 4D.</strong>
            </h1>
            <p className="ratnakara-landing__subtitle">
              A scientific 3D environment for exploring temperature, salinity,
              currents and coastal conditions across the Indian Ocean.
            </p>
            <div className={`ratnakara-landing__actions ${progress > 0.73 ? "is-visible" : ""}`}>
              <button className="ratnakara-landing__button" type="button">
                Register
              </button>
              <button
                className="ratnakara-landing__button ratnakara-landing__button--primary"
                type="button"
                onClick={handleViewGlobe}
              >
                View Globe
              </button>
            </div>
          </div>

          <div className="ratnakara-landing__meta">
            <span>New Scope</span>
            <span>an ocean intelligence platform</span>
          </div>

          <div
            className="ratnakara-landing__scroll"
            style={{ opacity: Math.max(0, 1 - progress * 5) }}
          >
            <span>Scroll</span>
            <div className="ratnakara-landing__line" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Component;

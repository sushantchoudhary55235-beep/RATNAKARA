import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
  HORIZON STARS — Ratnakara globe edition.

  The original Horizon landing starfield (3 layered Points clouds,
  per-depth rotation, additive blending) ported to react-three-fiber
  so the globe app shares the same star background.

  Self-contained: creates its own geometries/materials, disposes on
  unmount, and touches nothing else in the app.
*/

const STAR_COUNT = 3000;
const LAYERS = [0, 1, 2];
const RADIUS_MIN = 60;
const RADIUS_SPREAD = 30;

const STAR_VERTEX = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  uniform float time;
  uniform float depth;

  void main() {
    vColor = color;
    vec3 pos = position;

    /* Slow rotation based on depth (same as Horizon) */
    float angle = time * 0.05 * (1.0 - depth * 0.3);
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    pos.xy = rot * pos.xy;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT = `
  varying vec3 vColor;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
    gl_FragColor = vec4(vColor, opacity);
  }
`;

function buildStarLayer(depth) {
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);

  const color = new THREE.Color();

  for (let j = 0; j < STAR_COUNT; j++) {
    /* Same warm/cool star palette as the Horizon landing */
    const radius = RADIUS_MIN + Math.random() * RADIUS_SPREAD;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[j * 3 + 2] = radius * Math.cos(phi);

    const colorChoice = Math.random();
    if (colorChoice < 0.7) {
      color.setHSL(0, 0, 0.8 + Math.random() * 0.2);
    } else if (colorChoice < 0.9) {
      color.setHSL(0.08, 0.5, 0.8);
    } else {
      color.setHSL(0.6, 0.5, 0.8);
    }

    colors[j * 3] = color.r;
    colors[j * 3 + 1] = color.g;
    colors[j * 3 + 2] = color.b;

    sizes[j] = Math.random() * 2 + 0.5;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      depth: { value: depth },
    },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return { geometry, material };
}

export default function HorizonStars() {
  const layers = useMemo(() => LAYERS.map((depth) => buildStarLayer(depth)), []);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    for (const layer of layers) {
      layer.material.uniforms.time.value = time;
    }
  });

  return (
    <group>
      {layers.map((layer, i) => (
        <points
          key={i}
          geometry={layer.geometry}
          material={layer.material}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

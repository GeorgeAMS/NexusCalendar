import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Decorative 3D scene for the auth hero: a slowly rotating lattice of nodes
 * (deep blue) with warm orange highlights. Client-only, loaded lazily.
 */
export default function NexusScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 13);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const group = new THREE.Group();
    scene.add(group);

    const navy = new THREE.Color("#2b3f6b");
    const orange = new THREE.Color("#f97b1f");

    // Grid of nodes, like a calendar turning into a network.
    const cols = 5;
    const rows = 4;
    const spacing = 1.15;
    const nodeGeometry = new THREE.IcosahedronGeometry(0.11, 1);
    const points: THREE.Vector3[] = [];

    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        const position = new THREE.Vector3(
          (x - (cols - 1) / 2) * spacing,
          (y - (rows - 1) / 2) * spacing,
          Math.sin(x * 0.9 + y * 0.7) * 0.35,
        );
        points.push(position);
        const highlight = (x + y) % 4 === 0;
        const material = new THREE.MeshBasicMaterial({
          color: highlight ? orange : navy.clone().lerp(new THREE.Color("#8fa5d6"), 0.5),
        });
        const mesh = new THREE.Mesh(nodeGeometry, material);
        mesh.position.copy(position);
        mesh.scale.setScalar(highlight ? 1.5 : 1);
        group.add(mesh);
      }
    }

    // Connecting lines between neighbours.
    const linePositions: number[] = [];
    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        const index = x * rows + y;
        const current = points[index];
        if (!current) continue;
        const right = x < cols - 1 ? points[index + rows] : undefined;
        const up = y < rows - 1 ? points[index + 1] : undefined;
        for (const neighbour of [right, up]) {
          if (!neighbour) continue;
          linePositions.push(current.x, current.y, current.z, neighbour.x, neighbour.y, neighbour.z);
        }
      }
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: "#5f79b8", transparent: true, opacity: 0.5 }),
    );
    group.add(lines);

    // Orange ring orbiting the lattice.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.028, 12, 120),
      new THREE.MeshBasicMaterial({ color: orange, transparent: true, opacity: 0.75 }),
    );
    ring.rotation.x = Math.PI / 2.6;
    group.add(ring);

    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    function onPointerMove(event: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      target.x = ((event.clientX - rect.left) / rect.width - 0.5) * 0.6;
      target.y = ((event.clientY - rect.top) / rect.height - 0.5) * 0.4;
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    function resize() {
      const { clientWidth, clientHeight } = container!;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let frame = 0;
    const clock = new THREE.Clock();

    function animate() {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      pointer.x += (target.x - pointer.x) * 0.05;
      pointer.y += (target.y - pointer.y) * 0.05;
      const drift = reduceMotion ? 0 : elapsed * 0.12;
      group.rotation.y = drift + pointer.x;
      group.rotation.x = Math.sin(drift * 0.8) * 0.08 + pointer.y;
      ring.rotation.z = reduceMotion ? 0 : elapsed * 0.25;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      renderer.dispose();
      nodeGeometry.dispose();
      lineGeometry.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" aria-hidden />;
}

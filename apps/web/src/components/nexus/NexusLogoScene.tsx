import { useEffect, useRef } from "react";
import * as THREE from "three";

const LOGO_URL = "/brand/nexus-logo.png";

type Variant = "hero" | "mark";

/**
 * Pulls the solid studio plate out of the PNG and softens near-black fringes
 * so the artwork sits on navy without a hard rectangular matte.
 */
function prepareLogoTexture(texture: THREE.Texture): THREE.CanvasTexture {
  const image = texture.image as HTMLImageElement | ImageBitmap;
  const width = "width" in image ? image.width : 1;
  const height = "height" in image ? image.height : 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return texture as THREE.CanvasTexture;

  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, width, height);
  const data = frame.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 255;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    // Plate: near-black + low chroma → transparent.
    // Keep navy lettering (still dark, but with more blue chroma).
    let alpha = a / 255;
    if (luminance < 22 && chroma < 18) {
      alpha = 0;
    } else if (luminance < 42 && chroma < 28) {
      alpha *= (luminance - 22) / 20;
    }

    // Slight lift on deep navy type so it separates from the page navy.
    if (luminance < 90 && chroma > 12 && b >= r && b >= g) {
      data[i] = Math.min(255, Math.round(r + 18));
      data[i + 1] = Math.min(255, Math.round(g + 22));
      data[i + 2] = Math.min(255, Math.round(b + 32));
    }

    data[i + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  }

  ctx.putImageData(frame, 0, 0);
  const canvasTexture = new THREE.CanvasTexture(canvas);
  canvasTexture.colorSpace = THREE.SRGBColorSpace;
  canvasTexture.anisotropy = texture.anisotropy;
  canvasTexture.needsUpdate = true;
  return canvasTexture;
}

function makeRadialGlowTexture(inner: string, mid: string, outer = "rgba(0,0,0,0)"): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.45, mid);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Nearly-static logo with a soft atmospheric glow (no black matte card).
 */
export default function NexusLogoScene({ variant = "hero" }: { variant?: Variant }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMark = variant === "mark";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(isMark ? 36 : 40, 1, 0.1, 50);
    camera.position.set(0, 0, isMark ? 4.2 : 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const group = new THREE.Group();
    scene.add(group);

    // Whisper of warm bloom behind the mark — atmosphere, not a spotlight.
    const warmGlowMap = makeRadialGlowTexture("rgba(249, 123, 31, 0.28)", "rgba(249, 123, 31, 0.08)");
    const warmGlowMat = new THREE.MeshBasicMaterial({
      map: warmGlowMap,
      transparent: true,
      depthWrite: false,
      opacity: isMark ? 0.25 : 0.3,
      blending: THREE.AdditiveBlending,
    });
    const warmGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(isMark ? 1.6 : 2.8, isMark ? 1.6 : 2.6),
      warmGlowMat,
    );
    warmGlow.position.set(0, isMark ? 0.12 : 0.28, -0.06);
    group.add(warmGlow);

    const logoMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), logoMaterial);
    group.add(logoMesh);

    let disposed = false;
    let logoTexture: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.load(
      LOGO_URL,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        logoTexture = prepareLogoTexture(texture);
        texture.dispose();

        if (isMark) {
          logoTexture.wrapS = THREE.ClampToEdgeWrapping;
          logoTexture.wrapT = THREE.ClampToEdgeWrapping;
          logoTexture.offset.set(0, 0.38);
          logoTexture.repeat.set(1, 0.62);
        }

        logoMaterial.map = logoTexture;
        logoMaterial.opacity = 1;
        logoMaterial.needsUpdate = true;

        const img = logoTexture.image as HTMLCanvasElement;
        const fullAspect = img.width / Math.max(img.height, 1);
        const cropH = isMark ? 0.62 : 1;
        const aspect = fullAspect / cropH;
        const height = isMark ? 1.7 : 2.65;
        logoMesh.scale.set(height * aspect, height, 1);
      },
      undefined,
      () => {
        // Texture failed — keep empty transparent canvas.
      },
    );

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
      // Hero motion lives in AuthLayout parallax; keep the WebGL plate still.
      // Mark retains a barely perceptible idle float.
      if (!reduceMotion && isMark) {
        const t = clock.getElapsedTime();
        group.position.y = Math.sin(t * 0.35) * 0.01;
        warmGlowMat.opacity = 0.22 + Math.sin(t * 0.55) * 0.03;
      }
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      logoTexture?.dispose();
      warmGlowMap.dispose();
      warmGlow.geometry.dispose();
      warmGlowMat.dispose();
      logoMesh.geometry.dispose();
      logoMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [variant]);

  return <div ref={containerRef} className="h-full w-full" aria-hidden />;
}

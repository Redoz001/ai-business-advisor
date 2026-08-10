// providers/reucore.ts
// Server-side version of ReuCore procedural image generator

type GenerationOptions = {
  prompt: string;
  aspectRatio?: "square" | "portrait" | "landscape" | "default";
};

export async function generateLocalImage(options: GenerationOptions): Promise<string> {
  const { prompt, aspectRatio = "default" } = options;

  // 1. Parse prompt for keywords
  const words = prompt.toLowerCase().split(/\s+/);
  const isCity = /city|urban|skyline|building|tower|neon|cyberpunk/.test(prompt);
  const isSpace = /space|galaxy|planet|cosmos|stars|universe/.test(prompt);
  const isTech = /tech|digital|network|circuit|data|code/.test(prompt);
  const isNature = /nature|landscape|mountain|forest|ocean|sunset|lake/.test(prompt);
  const isAbstract = /abstract|geometric|pattern|colorful/.test(prompt);

  // 2. Select scene family
  let scene = "abstract";
  if (isCity) scene = "city";
  else if (isSpace) scene = "space";
  else if (isTech) scene = "tech";
  else if (isNature) scene = "landscape";
  else if (isAbstract) scene = "abstract";

  // 3. Generate a seed from the prompt
  let seed = 0;
  for (let i = 0; i < prompt.length; i++) {
    seed = (seed * 31 + prompt.charCodeAt(i)) & 0x7fffffff;
  }

  // 4. Determine dimensions
  let width = 1200,
    height = 675; // default landscape
  if (aspectRatio === "square") {
    width = 1024;
    height = 1024;
  } else if (aspectRatio === "portrait") {
    width = 768;
    height = 1365;
  }

  // 5. Build SVG based on scene
  let svgContent = "";

  // Common base gradient
  const gradientId = `g-${seed}`;
  const bgColor1 = `hsl(${(seed % 360)}, 70%, ${15 + (seed % 20)}%)`;
  const bgColor2 = `hsl(${(seed * 7 + 120) % 360}, 80%, ${25 + (seed % 15)}%)`;

  svgContent += `<defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgColor1}" />
      <stop offset="100%" stop-color="${bgColor2}" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  // Background rectangle
  svgContent += `<rect width="100%" height="100%" fill="url(#${gradientId})" />`;

  // Now add scene-specific elements
  const rng = (min: number, max: number) => {
    const x = Math.sin(seed++ * 9301 + 49297) * 10000;
    return min + (x - Math.floor(x)) * (max - min);
  };

  if (scene === "city") {
    // Buildings
    const numBuildings = 15 + Math.floor(rng(0, 10));
    const buildingWidth = width / (numBuildings + 2);
    for (let i = 0; i < numBuildings; i++) {
      const x = 50 + i * (buildingWidth + 5);
      const h = 100 + rng(0, height * 0.6);
      const y = height - h;
      const color = `hsl(${200 + (i * 7) % 60}, 80%, ${40 + (i % 30)}%)`;
      svgContent += `<rect x="${x}" y="${y}" width="${buildingWidth - 4}" height="${h}" fill="${color}" rx="2" />`;
      // Windows
      const winCount = Math.floor(h / 20);
      for (let j = 0; j < winCount; j++) {
        const wy = y + 10 + j * 20;
        const wx = x + 6 + ((j * 3) % (buildingWidth - 12));
        svgContent += `<rect x="${wx}" y="${wy}" width="6" height="8" fill="#ffdd77" opacity="0.7" rx="1" />`;
      }
    }
  } else if (scene === "space") {
    // Stars
    for (let i = 0; i < 200; i++) {
      const cx = rng(0, width);
      const cy = rng(0, height);
      const r = rng(0.5, 2.5);
      const opacity = 0.3 + rng(0, 0.7);
      svgContent += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="${opacity}" />`;
    }
    // Planets
    for (let i = 0; i < 3; i++) {
      const cx = rng(100, width - 100);
      const cy = rng(100, height - 100);
      const rad = 30 + rng(0, 60);
      const color = `hsl(${i * 120 + 30}, 70%, ${50 + i * 10}%)`;
      svgContent += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${color}" opacity="0.8" />`;
    }
  } else if (scene === "tech") {
    // Network nodes and connections
    const nodes: { x: number; y: number }[] = [];
    for (let i = 0; i < 30; i++) {
      nodes.push({ x: rng(50, width - 50), y: rng(50, height - 50) });
    }
    // Draw lines
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (rng(0, 100) < 15) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300) {
            svgContent += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="#00ffff" stroke-width="1.5" opacity="0.4" />`;
          }
        }
      }
    }
    // Nodes
    for (const n of nodes) {
      svgContent += `<circle cx="${n.x}" cy="${n.y}" r="5" fill="#00ffff" filter="url(#glow)" />`;
    }
  } else if (scene === "landscape") {
    // Mountains
    const numMountains = 5 + Math.floor(rng(0, 5));
    for (let i = 0; i < numMountains; i++) {
      const cx = (i + 0.5) * (width / numMountains);
      const base = height * 0.6;
      const peak = height * 0.2 + rng(0, height * 0.3);
      const controlX1 = cx - 100 + rng(0, 80);
      const controlY1 = base - peak * 0.6;
      const controlX2 = cx + 100 - rng(0, 80);
      const controlY2 = base - peak * 0.6;
      const color = `hsl(${140 + i * 10}, 60%, ${30 + i * 5}%)`;
      svgContent += `<path d="M ${cx - 150} ${base} Q ${controlX1} ${controlY1} ${cx} ${base - peak} Q ${controlX2} ${controlY2} ${cx + 150} ${base} Z" fill="${color}" />`;
    }
  } else {
    // Abstract
    for (let i = 0; i < 50; i++) {
      const x = rng(0, width);
      const y = rng(0, height);
      const size = 20 + rng(0, 80);
      const angle = rng(0, 360);
      const color = `hsl(${rng(0, 360)}, 80%, ${50 + rng(0, 30)}%)`;
      svgContent += `<rect x="${x}" y="${y}" width="${size}" height="${size}" transform="rotate(${angle}, ${x + size/2}, ${y + size/2})" fill="${color}" opacity="0.6" />`;
    }
  }

  // 6. Add prompt text as title (small, bottom-right)
  const title = prompt.length > 40 ? prompt.slice(0, 40) + "..." : prompt;
  svgContent += `<text x="${width - 20}" y="${height - 20}" font-family="sans-serif" font-size="14" fill="rgba(255,255,255,0.5)" text-anchor="end">${title}</text>`;
  svgContent += `<text x="20" y="30" font-family="sans-serif" font-size="12" fill="rgba(255,255,255,0.3)">ReuCore · ${new Date().toISOString().slice(0,10)}</text>`;

  // 7. Complete SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgContent}</svg>`;

  // 8. Convert to base64 data URL
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}
import type { SceneBlueprint } from "./types";

export function renderSceneToSvg(scene: SceneBlueprint): string {
  const [bg, primary, accent, text] = scene.colorPalette;

  const headline = scene.textOverlay?.headline || scene.title;
  const subheadline = scene.textOverlay?.subheadline || scene.description;
  const footer = scene.textOverlay?.footer || "ReuNexus";

  return `
<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.9"/>
      <stop offset="45%" stop-color="${accent}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="675" fill="${bg}"/>

  <circle cx="850" cy="280" r="260" fill="url(#glow)" opacity="0.75"/>
  <circle cx="300" cy="520" r="220" fill="${primary}" opacity="0.12"/>

  <g opacity="0.35">
    ${Array.from({ length: 22 })
      .map((_, i) => {
        const x = 80 + i * 52;
        return `<line x1="${x}" y1="0" x2="${x - 180}" y2="675" stroke="${primary}" stroke-opacity="0.35"/>`;
      })
      .join("")}
  </g>

  <g transform="translate(730 190)">
    <circle cx="120" cy="120" r="110" fill="none" stroke="url(#line)" stroke-width="3"/>
    <circle cx="120" cy="120" r="70" fill="none" stroke="${accent}" stroke-opacity="0.7" stroke-width="2"/>
    <circle cx="120" cy="120" r="18" fill="${primary}"/>

    <line x1="120" y1="120" x2="40" y2="55" stroke="${accent}" stroke-width="2"/>
    <line x1="120" y1="120" x2="205" y2="65" stroke="${accent}" stroke-width="2"/>
    <line x1="120" y1="120" x2="70" y2="205" stroke="${accent}" stroke-width="2"/>
    <line x1="120" y1="120" x2="210" y2="195" stroke="${accent}" stroke-width="2"/>

    <circle cx="40" cy="55" r="8" fill="${text}"/>
    <circle cx="205" cy="65" r="8" fill="${text}"/>
    <circle cx="70" cy="205" r="8" fill="${text}"/>
    <circle cx="210" cy="195" r="8" fill="${text}"/>
  </g>

  <text x="80" y="130" fill="${primary}" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="6">
    REUNEXUS VISUAL ENGINE
  </text>

  <foreignObject x="80" y="170" width="620" height="230">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: ${text}; font-size: 58px; line-height: 1.05; font-weight: 900;">
      ${escapeHtml(headline)}
    </div>
  </foreignObject>

  <foreignObject x="80" y="420" width="620" height="120">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #cbd5e1; font-size: 24px; line-height: 1.4;">
      ${escapeHtml(subheadline)}
    </div>
  </foreignObject>

  <text x="80" y="610" fill="${text}" font-family="Arial, sans-serif" font-size="26" font-weight="800">
    ${escapeHtml(footer)}
  </text>

  <text x="1030" y="610" fill="${primary}" font-family="Arial, sans-serif" font-size="18" font-weight="700">
    remuai.space
  </text>
</svg>
`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
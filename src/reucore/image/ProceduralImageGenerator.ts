export type GeneratedImage = {
  svg: string;
  width: number;
  height: number;
  seed: number;
  prompt: string;
};

type Palette = {
  backgroundA: string;
  backgroundB: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  text: string;
};

type SceneKind =
  | "city"
  | "landscape"
  | "space"
  | "technology"
  | "logo"
  | "poster"
  | "abstract";

type SceneConfig = {
  kind: SceneKind;
  title: string;
  subtitle: string;
  cinematic: boolean;
  night: boolean;
  neon: boolean;
  minimal: boolean;
  animated: boolean;
};

const PALETTES: Palette[] = [
  {
    backgroundA: "#020617",
    backgroundB: "#312e81",
    primary: "#7c3aed",
    secondary: "#2563eb",
    accent: "#22d3ee",
    glow: "#a78bfa",
    text: "#ffffff",
  },
  {
    backgroundA: "#09090b",
    backgroundB: "#3f0d12",
    primary: "#ef4444",
    secondary: "#f97316",
    accent: "#facc15",
    glow: "#fb7185",
    text: "#ffffff",
  },
  {
    backgroundA: "#04130c",
    backgroundB: "#064e3b",
    primary: "#10b981",
    secondary: "#14b8a6",
    accent: "#a3e635",
    glow: "#5eead4",
    text: "#ffffff",
  },
  {
    backgroundA: "#09090b",
    backgroundB: "#18181b",
    primary: "#e4e4e7",
    secondary: "#71717a",
    accent: "#ffffff",
    glow: "#d4d4d8",
    text: "#ffffff",
  },
  {
    backgroundA: "#111827",
    backgroundB: "#581c87",
    primary: "#ec4899",
    secondary: "#8b5cf6",
    accent: "#38bdf8",
    glow: "#f0abfc",
    text: "#ffffff",
  },
];

export class ProceduralImageGenerator {
  generate(prompt: string, options?: { animated?: boolean }): GeneratedImage {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      throw new Error("Enter a prompt before generating an image.");
    }

    const seed = this.hash(cleanPrompt);
    const random = this.random(seed);
    const palette = PALETTES[seed % PALETTES.length];
    const config = this.analyze(cleanPrompt);
    config.animated = options?.animated ?? false;

    const width = this.detectWidth(cleanPrompt);
    const height = this.detectHeight(cleanPrompt);

    const scene = this.renderScene(
      config,
      palette,
      width,
      height,
      random
    );

    const svg = this.wrapSvg({
      prompt: cleanPrompt,
      width,
      height,
      palette,
      scene,
      seed,
      animated: config.animated,
    });

    return {
      svg,
      width,
      height,
      seed,
      prompt: cleanPrompt,
    };
  }

  private analyze(prompt: string): SceneConfig {
    const text = prompt.toLowerCase();

    let kind: SceneKind = "abstract";

    if (/\b(city|dubai|skyline|building|street|urban|downtown)\b/.test(text)) {
      kind = "city";
    } else if (
      /\b(mountain|forest|ocean|beach|desert|landscape|nature|sunset|waterfall|river|lake|island|tropical|snow|ice)\b/.test(
        text
      )
    ) {
      kind = "landscape";
    } else if (
      /\b(space|planet|galaxy|moon|stars|universe|cosmic|nebula|astronaut|rocket)\b/.test(text)
    ) {
      kind = "space";
    } else if (
      /\b(ai|technology|cyber|computer|network|robot|future|digital|circuit|hologram)\b/.test(
        text
      )
    ) {
      kind = "technology";
    } else if (/\b(logo|symbol|icon|brand mark)\b/.test(text)) {
      kind = "logo";
    } else if (
      /\b(poster|advertisement|ad|thumbnail|banner|cover)\b/.test(text)
    ) {
      kind = "poster";
    }

    return {
      kind,
      title: this.makeTitle(prompt),
      subtitle: this.makeSubtitle(kind),
      cinematic: /\b(cinematic|dramatic|movie|film)\b/.test(text),
      night: /\b(night|dark|midnight|evening)\b/.test(text),
      neon: /\b(neon|cyberpunk|glowing)\b/.test(text),
      minimal: /\b(minimal|minimalist|simple|clean)\b/.test(text),
      animated: false,
    };
  }

  private wrapSvg(input: {
    prompt: string;
    width: number;
    height: number;
    palette: Palette;
    scene: string;
    seed: number;
    animated: boolean;
  }): string {
    const safePrompt = this.escape(input.prompt);

    const animationStyles = input.animated
      ? `
    <style>
      @keyframes drift {
        0% { transform: translateX(0); }
        100% { transform: translateX(${input.width * 0.15}px); }
      }
      @keyframes twinkle {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 1; }
      }
      @keyframes flow {
        0% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
        100% { transform: translateY(0); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes rise {
        0% { transform: translateY(0); opacity: 0; }
        20% { opacity: 0.8; }
        100% { transform: translateY(-${input.height * 0.3}px); opacity: 0; }
      }
      @keyframes shimmer {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .anim-drift { animation: drift ${6 + (input.seed % 4)}s ease-in-out infinite alternate; }
      .anim-twinkle { animation: twinkle ${2 + (input.seed % 3)}s ease-in-out infinite; }
      .anim-flow { animation: flow ${3 + (input.seed % 3)}s ease-in-out infinite; }
      .anim-pulse { animation: pulse ${2 + (input.seed % 2)}s ease-in-out infinite; }
      .anim-spin { animation: spin ${8 + (input.seed % 6)}s linear infinite; }
      .anim-rise { animation: rise ${4 + (input.seed % 3)}s ease-out infinite; }
    </style>
    `
      : "";

    return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${input.width}"
  height="${input.height}"
  viewBox="0 0 ${input.width} ${input.height}"
  role="img"
  aria-label="${safePrompt}"
>
  <defs>
    ${animationStyles}

    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${input.palette.backgroundA}" />
      <stop offset="100%" stop-color="${input.palette.backgroundB}" />
    </linearGradient>

    <radialGradient id="mainGlow">
      <stop offset="0%" stop-color="${input.palette.glow}" stop-opacity="0.85" />
      <stop offset="55%" stop-color="${input.palette.primary}" stop-opacity="0.22" />
      <stop offset="100%" stop-color="${input.palette.primary}" stop-opacity="0" />
    </radialGradient>

    <linearGradient id="objectGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${input.palette.accent}" />
      <stop offset="50%" stop-color="${input.palette.primary}" />
      <stop offset="100%" stop-color="${input.palette.secondary}" />
    </linearGradient>

    <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${input.palette.backgroundA}" />
      <stop offset="60%" stop-color="${input.palette.backgroundB}" />
      <stop offset="100%" stop-color="${input.palette.primary}" stop-opacity="0.6" />
    </linearGradient>

    <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${input.palette.secondary}" stop-opacity="0.4" />
      <stop offset="100%" stop-color="${input.palette.backgroundA}" stop-opacity="0.9" />
    </linearGradient>

    <filter id="blurLarge">
      <feGaussianBlur stdDeviation="55" />
    </filter>

    <filter id="blurMedium">
      <feGaussianBlur stdDeviation="18" />
    </filter>

    <filter id="softGlow">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="shadow">
      <feDropShadow
        dx="0"
        dy="18"
        stdDeviation="20"
        flood-color="#000000"
        flood-opacity="0.55"
      />
    </filter>

    <filter id="cloudTexture">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="${input.seed % 100}" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.15 0.3 0.15 0" />
      </feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic" />
    </filter>

    <filter id="waterTexture">
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.05" numOctaves="3" seed="${(input.seed + 7) % 100}" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.1 0.2 0.1 0" />
      </feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic" />
    </filter>

    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${(input.seed + 13) % 100}" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.05" />
      </feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic" />
    </filter>

    <filter id="lighting3d">
      <feDiffuseLighting in="SourceGraphic" surfaceScale="3" diffuseConstant="1.2" lighting-color="#ffffff">
        <feDistantLight azimuth="225" elevation="45" />
      </feDiffuseLighting>
    </filter>

    <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
      <path
        d="M 42 0 L 0 0 0 42"
        fill="none"
        stroke="${input.palette.accent}"
        stroke-opacity="0.08"
        stroke-width="1"
      />
    </pattern>
  </defs>

  <rect width="100%" height="100%" fill="url(#background)" />
  <rect width="100%" height="100%" fill="url(#grid)" />

  <circle
    cx="${input.width * 0.78}"
    cy="${input.height * 0.22}"
    r="${Math.min(input.width, input.height) * 0.36}"
    fill="url(#mainGlow)"
    filter="url(#blurLarge)"
  />

  ${input.scene}

  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.4" />

  <metadata>
    ReuNexus procedural image
    Seed: ${input.seed}
    Prompt: ${safePrompt}
  </metadata>
</svg>
`.trim();
  }

  private renderScene(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number,
    random: () => number
  ): string {
    switch (config.kind) {
      case "city":
        return this.renderCity(config, palette, width, height, random);

      case "landscape":
        return this.renderLandscape(config, palette, width, height, random);

      case "space":
        return this.renderSpace(config, palette, width, height, random);

      case "technology":
        return this.renderTechnology(config, palette, width, height, random);

      case "logo":
        return this.renderLogo(config, palette, width, height);

      case "poster":
        return this.renderPoster(config, palette, width, height, random);

      default:
        return this.renderAbstract(config, palette, width, height, random);
    }
  }

  private renderCity(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number,
    random: () => number
  ): string {
    const ground = height * 0.82;
    const buildings: string[] = [];
    const reflections: string[] = [];

    let x = 0;

    while (x < width) {
      const buildingWidth = 45 + random() * 90;
      const buildingHeight = 120 + random() * height * 0.42;
      const y = ground - buildingHeight;

      const windows: string[] = [];

      for (let wx = x + 14; wx < x + buildingWidth - 10; wx += 22) {
        for (let wy = y + 20; wy < ground - 18; wy += 26) {
          if (random() > 0.34) {
            const isLit = random() > 0.3;
            windows.push(`
              <rect
                x="${wx.toFixed(1)}"
                y="${wy.toFixed(1)}"
                width="7"
                height="11"
                rx="2"
                fill="${isLit ? palette.accent : "#1a1a2e"}"
                opacity="${isLit ? (0.35 + random() * 0.65).toFixed(2) : "0.3"}"
                ${config.animated ? 'class="anim-twinkle"' : ""}
              />
            `);
          }
        }
      }

      // Building reflection on ground
      reflections.push(`
        <rect
          x="${x.toFixed(1)}"
          y="${ground}"
          width="${buildingWidth.toFixed(1)}"
          height="${(buildingHeight * 0.15).toFixed(1)}"
          fill="${palette.primary}"
          opacity="0.08"
          transform="scale(1, -1) translate(0, -${(ground * 2).toFixed(1)})"
        />
      `);

      buildings.push(`
        <g filter="url(#shadow)">
          <rect
            x="${x.toFixed(1)}"
            y="${y.toFixed(1)}"
            width="${buildingWidth.toFixed(1)}"
            height="${buildingHeight.toFixed(1)}"
            rx="${config.neon ? 10 : 4}"
            fill="#06080f"
            stroke="${palette.primary}"
            stroke-opacity="${config.neon ? 0.7 : 0.22}"
          />
          <rect
            x="${x.toFixed(1)}"
            y="${y.toFixed(1)}"
            width="${buildingWidth.toFixed(1)}"
            height="${(buildingHeight * 0.12).toFixed(1)}"
            fill="${palette.primary}"
            opacity="0.15"
          />
          ${windows.join("")}
        </g>
      `);

      x += buildingWidth + 8;
    }

    // Animated traffic lights on the street
    const trafficLights = config.animated
      ? `
      <g class="anim-pulse">
        <circle cx="${width * 0.2}" cy="${ground - 8}" r="3" fill="#ff4444" />
        <circle cx="${width * 0.35}" cy="${ground - 8}" r="3" fill="#ffaa00" />
        <circle cx="${width * 0.5}" cy="${ground - 8}" r="3" fill="#44ff44" />
        <circle cx="${width * 0.65}" cy="${ground - 8}" r="3" fill="#ff4444" />
        <circle cx="${width * 0.8}" cy="${ground - 8}" r="3" fill="#ffaa00" />
      </g>
      `
      : "";

    return `
      <circle
        cx="${width * 0.76}"
        cy="${height * 0.24}"
        r="${height * 0.12}"
        fill="${palette.accent}"
        opacity="0.75"
        filter="url(#softGlow)"
        ${config.animated ? 'class="anim-pulse"' : ""}
      />

      ${buildings.join("")}
      ${reflections.join("")}

      <path
        d="M0 ${ground} C ${width * 0.25} ${ground - 35},
           ${width * 0.65} ${ground + 35}, ${width} ${ground - 5}
           L ${width} ${height} L 0 ${height} Z"
        fill="#020308"
      />

      ${trafficLights}

      ${this.renderHeading(config, palette, width, height)}
    `;
  }

  private renderLandscape(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number,
    random: () => number
  ): string {
    const sunX = width * (0.62 + random() * 0.18);
    const sunY = height * 0.25;
    const isWater = /\b(ocean|beach|sea|water|lake|river)\b/.test(config.title.toLowerCase());
    const isSnow = /\b(snow|ice|winter|mountain)\b/.test(config.title.toLowerCase());

    // Clouds - animated if video
    const clouds = config.animated
      ? `
      <g class="anim-drift" filter="url(#cloudTexture)">
        <ellipse cx="${width * 0.2}" cy="${height * 0.15}" rx="${width * 0.12}" ry="${height * 0.04}" fill="#ffffff" opacity="0.3" />
        <ellipse cx="${width * 0.5}" cy="${height * 0.1}" rx="${width * 0.15}" ry="${height * 0.05}" fill="#ffffff" opacity="0.25" />
        <ellipse cx="${width * 0.8}" cy="${height * 0.18}" rx="${width * 0.1}" ry="${height * 0.035}" fill="#ffffff" opacity="0.2" />
      </g>
      `
      : `
      <g filter="url(#cloudTexture)">
        <ellipse cx="${width * 0.2}" cy="${height * 0.15}" rx="${width * 0.12}" ry="${height * 0.04}" fill="#ffffff" opacity="0.3" />
        <ellipse cx="${width * 0.5}" cy="${height * 0.1}" rx="${width * 0.15}" ry="${height * 0.05}" fill="#ffffff" opacity="0.25" />
        <ellipse cx="${width * 0.8}" cy="${height * 0.18}" rx="${width * 0.1}" ry="${height * 0.035}" fill="#ffffff" opacity="0.2" />
      </g>
      `;

    // Water reflection if water scene
    const waterReflection = isWater
      ? `
      <g filter="url(#waterTexture)" opacity="0.5">
        <ellipse cx="${sunX}" cy="${height * 0.55}" rx="${height * 0.08}" ry="${height * 0.02}" fill="${palette.accent}" opacity="0.4" />
        <ellipse cx="${sunX}" cy="${height * 0.6}" rx="${height * 0.06}" ry="${height * 0.015}" fill="${palette.accent}" opacity="0.3" />
        <ellipse cx="${sunX}" cy="${height * 0.65}" rx="${height * 0.04}" ry="${height * 0.01}" fill="${palette.accent}" opacity="0.2" />
      </g>
      `
      : "";

    // Snow particles if snow scene
    const snowParticles = isSnow && config.animated
      ? `
      <g>
        ${Array.from({ length: 30 }, (_, i) => `
          <circle
            cx="${(random() * width).toFixed(1)}"
            cy="${(random() * height * 0.5).toFixed(1)}"
            r="${(1 + random() * 2).toFixed(1)}"
            fill="#ffffff"
            class="anim-rise"
            style="animation-delay: ${(random() * 3).toFixed(1)}s"
          />
        `).join("")}
      </g>
      `
      : "";

    return `
      <circle
        cx="${sunX}"
        cy="${sunY}"
        r="${height * 0.1}"
        fill="${palette.accent}"
        opacity="0.9"
        filter="url(#softGlow)"
        ${config.animated ? 'class="anim-pulse"' : ""}
      />

      ${clouds}

      <path
        d="M0 ${height * 0.72}
           L ${width * 0.17} ${height * 0.42}
           L ${width * 0.32} ${height * 0.68}
           L ${width * 0.5} ${height * 0.3}
           L ${width * 0.72} ${height * 0.7}
           L ${width * 0.86} ${height * 0.47}
           L ${width} ${height * 0.67}
           L ${width} ${height}
           L0 ${height} Z"
        fill="${palette.secondary}"
        opacity="0.42"
        filter="url(#lighting3d)"
      />

      <path
        d="M0 ${height * 0.79}
           C ${width * 0.22} ${height * 0.64},
             ${width * 0.34} ${height * 0.88},
             ${width * 0.52} ${height * 0.72}
           C ${width * 0.72} ${height * 0.55},
             ${width * 0.87} ${height * 0.82},
             ${width} ${height * 0.7}
           L ${width} ${height}
           L 0 ${height} Z"
        fill="${palette.primary}"
        opacity="0.72"
        filter="url(#lighting3d)"
      />

      <path
        d="M0 ${height * 0.86}
           C ${width * 0.3} ${height * 0.76},
             ${width * 0.62} ${height * 0.93},
             ${width} ${height * 0.8}
           L ${width} ${height}
           L0 ${height} Z"
        fill="#020617"
      />

      ${waterReflection}
      ${snowParticles}

      ${this.renderHeading(config, palette, width, height)}
    `;
  }

  private renderSpace(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number,
    random: () => number
  ): string {
    const stars: string[] = [];

    for (let i = 0; i < 120; i++) {
      stars.push(`
        <circle
          cx="${(random() * width).toFixed(1)}"
          cy="${(random() * height).toFixed(1)}"
          r="${(0.6 + random() * 2.2).toFixed(1)}"
          fill="#ffffff"
          opacity="${(0.25 + random() * 0.75).toFixed(2)}"
          ${config.animated ? `class="anim-twinkle" style="animation-delay: ${(random() * 3).toFixed(1)}s"` : ""}
        />
      `);
    }

    // Nebula effect
    const nebula = `
      <ellipse
        cx="${width * 0.3}"
        cy="${height * 0.3}"
        rx="${width * 0.25}"
        ry="${height * 0.2}"
        fill="${palette.primary}"
        opacity="0.15"
        filter="url(#blurLarge)"
      />
      <ellipse
        cx="${width * 0.7}"
        cy="${height * 0.6}"
        rx="${width * 0.2}"
        ry="${height * 0.15}"
        fill="${palette.accent}"
        opacity="0.12"
        filter="url(#blurLarge)"
      />
    `;

    return `
      ${nebula}
      ${stars.join("")}

      <ellipse
        cx="${width * 0.7}"
        cy="${height * 0.42}"
        rx="${height * 0.23}"
        ry="${height * 0.23}"
        fill="url(#objectGradient)"
        filter="url(#shadow)"
        ${config.animated ? 'class="anim-flow"' : ""}
      />

      <ellipse
        cx="${width * 0.7}"
        cy="${height * 0.42}"
        rx="${height * 0.36}"
        ry="${height * 0.075}"
        fill="none"
        stroke="${palette.accent}"
        stroke-width="13"
        stroke-opacity="0.72"
        transform="rotate(-14 ${width * 0.7} ${height * 0.42})"
        filter="url(#softGlow)"
        ${config.animated ? 'class="anim-spin"' : ""}
      />

      <circle
        cx="${width * 0.64}"
        cy="${height * 0.34}"
        r="${height * 0.04}"
        fill="#ffffff"
        opacity="0.35"
      />

      ${this.renderHeading(config, palette, width, height)}
    `;
  }

  private renderTechnology(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number,
    random: () => number
  ): string {
    const nodes: Array<{ x: number; y: number; r: number }> = [];

    for (let i = 0; i < 22; i++) {
      nodes.push({
        x: width * 0.42 + random() * width * 0.53,
        y: height * 0.12 + random() * height * 0.72,
        r: 4 + random() * 10,
      });
    }

    const connections: string[] = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[(i + 3) % nodes.length];

      connections.push(`
        <line
          x1="${a.x}"
          y1="${a.y}"
          x2="${b.x}"
          y2="${b.y}"
          stroke="${palette.accent}"
          stroke-opacity="0.22"
          stroke-width="2"
          ${config.animated ? 'class="anim-pulse"' : ""}
        />
      `);
    }

    return `
      <g>
        ${connections.join("")}

        ${nodes
          .map(
            (node, i) => `
          <circle
            cx="${node.x}"
            cy="${node.y}"
            r="${node.r}"
            fill="${palette.primary}"
            stroke="${palette.accent}"
            stroke-width="2"
            filter="url(#softGlow)"
            ${config.animated ? `class="anim-pulse" style="animation-delay: ${(i * 0.2).toFixed(1)}s"` : ""}
          />
        `
          )
          .join("")}
      </g>

      <g
        transform="translate(${width * 0.72} ${height * 0.45})"
        filter="url(#shadow)"
        ${config.animated ? 'class="anim-flow"' : ""}
      >
        <circle
          r="${height * 0.17}"
          fill="#050816"
          stroke="${palette.accent}"
          stroke-width="3"
        />

        <circle
          r="${height * 0.12}"
          fill="url(#objectGradient)"
          opacity="0.88"
          filter="url(#softGlow)"
        />

        <path
          d="M-${height * 0.075} 0
             C-${height * 0.04} -${height * 0.08},
               ${height * 0.04} -${height * 0.08},
               ${height * 0.075} 0
             C${height * 0.04} ${height * 0.08},
               -${height * 0.04} ${height * 0.08},
               -${height * 0.075} 0 Z"
          fill="#ffffff"
          opacity="0.86"
        />
      </g>

      ${this.renderHeading(config, palette, width, height)}
    `;
  }

  private renderLogo(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number
  ): string {
    const centerX = width / 2;
    const centerY = height * 0.43;
    const size = Math.min(width, height) * 0.2;

    return `
      <g
        transform="translate(${centerX} ${centerY})"
        filter="url(#shadow)"
        ${config.animated ? 'class="anim-flow"' : ""}
      >
        <rect
          x="-${size}"
          y="-${size}"
          width="${size * 2}"
          height="${size * 2}"
          rx="${size * 0.42}"
          fill="#06070b"
          stroke="${palette.accent}"
          stroke-width="3"
        />

        <path
          d="M-${size * 0.52} ${size * 0.46}
             L0 -${size * 0.58}
             L${size * 0.52} ${size * 0.46}
             L${size * 0.18} ${size * 0.46}
             L0 ${size * 0.1}
             L-${size * 0.18} ${size * 0.46} Z"
          fill="url(#objectGradient)"
          filter="url(#softGlow)"
        />
      </g>

      <text
        x="${centerX}"
        y="${height * 0.76}"
        text-anchor="middle"
        fill="${palette.text}"
        font-family="Inter, Arial, sans-serif"
        font-size="${Math.max(30, width * 0.038)}"
        font-weight="800"
        letter-spacing="3"
      >
        ${this.escape(config.title)}
      </text>
    `;
  }

  private renderPoster(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number,
    random: () => number
  ): string {
    const rings: string[] = [];

    for (let i = 0; i < 6; i++) {
      rings.push(`
        <circle
          cx="${width * 0.73}"
          cy="${height * 0.47}"
          r="${height * (0.08 + i * 0.055)}"
          fill="none"
          stroke="${i % 2 === 0 ? palette.accent : palette.primary}"
          stroke-width="${2 + random() * 4}"
          stroke-opacity="${0.18 + i * 0.08}"
          ${config.animated ? `class="anim-pulse" style="animation-delay: ${(i * 0.3).toFixed(1)}s"` : ""}
        />
      `);
    }

    return `
      ${rings.join("")}

      <rect
        x="${width * 0.6}"
        y="${height * 0.23}"
        width="${width * 0.26}"
        height="${height * 0.48}"
        rx="30"
        fill="url(#objectGradient)"
        opacity="0.82"
        transform="rotate(8 ${width * 0.73} ${height * 0.47})"
        filter="url(#shadow)"
        ${config.animated ? 'class="anim-flow"' : ""}
      />

      ${this.renderHeading(config, palette, width, height)}
    `;
  }

  private renderAbstract(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number,
    random: () => number
  ): string {
    const shapes: string[] = [];

    for (let i = 0; i < 13; i++) {
      const x = random() * width;
      const y = random() * height;
      const size = 35 + random() * 150;

      shapes.push(`
        <rect
          x="${x.toFixed(1)}"
          y="${y.toFixed(1)}"
          width="${size.toFixed(1)}"
          height="${size.toFixed(1)}"
          rx="${(size * 0.3).toFixed(1)}"
          fill="${i % 2 === 0 ? palette.primary : palette.secondary}"
          opacity="${(0.08 + random() * 0.24).toFixed(2)}"
          transform="rotate(${(-35 + random() * 70).toFixed(1)} ${x} ${y})"
          ${config.animated ? `class="anim-flow" style="animation-delay: ${(i * 0.2).toFixed(1)}s"` : ""}
        />
      `);
    }

    return `
      ${shapes.join("")}

      <path
        d="M ${width * 0.55} ${height * 0.15}
           C ${width * 0.92} ${height * 0.04},
             ${width * 0.96} ${height * 0.78},
             ${width * 0.58} ${height * 0.8}
           C ${width * 0.34} ${height * 0.72},
             ${width * 0.35} ${height * 0.28},
             ${width * 0.55} ${height * 0.15} Z"
        fill="url(#objectGradient)"
        opacity="0.8"
        filter="url(#shadow)"
        ${config.animated ? 'class="anim-flow"' : ""}
      />

      ${this.renderHeading(config, palette, width, height)}
    `;
  }

  private renderHeading(
    config: SceneConfig,
    palette: Palette,
    width: number,
    height: number
  ): string {
    const title = this.escape(config.title);
    const subtitle = this.escape(config.subtitle);
    const titleSize = Math.max(34, Math.min(74, width * 0.052));

    return `
      <g transform="translate(${width * 0.065} ${height * 0.25})">
        <rect
          x="0"
          y="-34"
          width="64"
          height="5"
          rx="3"
          fill="${palette.accent}"
          filter="url(#softGlow)"
        />

        <text
          x="0"
          y="40"
          fill="${palette.text}"
          font-family="Inter, Arial, sans-serif"
          font-size="${titleSize}"
          font-weight="850"
          letter-spacing="-1.2"
        >
          ${title}
        </text>

        <text
          x="2"
          y="${titleSize + 72}"
          fill="#d4d4d8"
          font-family="Inter, Arial, sans-serif"
          font-size="${Math.max(17, width * 0.016)}"
          font-weight="500"
          opacity="0.8"
        >
          ${subtitle}
        </text>

        <text
          x="2"
          y="${titleSize + 110}"
          fill="${palette.accent}"
          font-family="Inter, Arial, sans-serif"
          font-size="${Math.max(12, width * 0.01)}"
          font-weight="700"
          letter-spacing="4"
        >
          CREATED BY REUNEXUS
        </text>
      </g>
    `;
  }

  private detectWidth(prompt: string): number {
    if (/\bportrait|vertical|9:16\b/i.test(prompt)) return 768;
    if (/\bsquare|1:1\b/i.test(prompt)) return 1024;
    return 1200;
  }

  private detectHeight(prompt: string): number {
    if (/\bportrait|vertical|9:16\b/i.test(prompt)) return 1365;
    if (/\bsquare|1:1\b/i.test(prompt)) return 1024;
    return 675;
  }

  private makeTitle(prompt: string): string {
    const cleaned = prompt
      .replace(
        /\b(create|generate|make|draw|design|render|produce|an|a|the|image|picture|poster|logo|of|for|me|please|video|animate|animation)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

    const words = cleaned.split(" ").filter(Boolean).slice(0, 6);

    if (!words.length) return "Generated Vision";

    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private makeSubtitle(kind: SceneKind): string {
    const subtitles: Record<SceneKind, string> = {
      city: "A future shaped by architecture, light and ambition.",
      landscape: "A constructed world of atmosphere, depth and motion.",
      space: "Beyond the limits of the known universe.",
      technology: "Intelligence, infrastructure and possibility connected.",
      logo: "A distinctive visual identity engineered for recognition.",
      poster: "A high-impact visual designed to command attention.",
      abstract: "Form, energy and imagination combined.",
    };

    return subtitles[kind];
  }

  private hash(value: string): number {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  private random(seed: number): () => number {
    let state = seed || 1;

    return () => {
      state += 0x6d2b79f5;

      let result = state;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, "\x26amp;")
      .replace(/</g, "\x26lt;")
      .replace(/>/g, "\x26gt;")
      .replace(/"/g, "\x26quot;")
      .replace(/'/g, "\x26apos;");
  }
}
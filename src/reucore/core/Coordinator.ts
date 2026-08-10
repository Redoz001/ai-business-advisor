import type { ModuleContext, ReuCoreModule } from "./Module";

export type ReuCoreMessage = {
  type: string;
  payload?: unknown;
  source?: string;
  timestamp: number;
};

export class Coordinator {
  private modules = new Map<string, ReuCoreModule>();
  private running = false;

  private context: ModuleContext = {
    send: async (type, payload, source) => {
      await this.send(type, payload, source);
    },

    getModule: <T = unknown>(name: string) => {
      return this.getModule(name) as T | undefined;
    },

    isEngineRunning: () => {
      return this.isRunning();
    },
  };

  async register(module: ReuCoreModule) {
    if (this.modules.has(module.name)) {
      throw new Error(`Module already registered: ${module.name}`);
    }

    this.modules.set(module.name, module);

    await module.initialize?.(this.context);
  }

  async start() {
    if (this.running) return;

    for (const module of this.modules.values()) {
      await module.start?.();
    }

    this.running = true;
  }

  async stop() {
    if (!this.running) return;

    for (const module of this.modules.values()) {
      await module.stop?.();
    }

    this.running = false;
  }

  async send(type: string, payload?: unknown, source?: string) {
    const message: ReuCoreMessage = {
      type,
      payload,
      source,
      timestamp: Date.now(),
    };

    for (const module of this.modules.values()) {
      await module.onMessage?.(message);
    }
  }

  getModule(name: string) {
    return this.modules.get(name);
  }

  getModules() {
    return Array.from(this.modules.values());
  }

  isRunning() {
    return this.running;
  }

  healthCheck() {
    return this.getModules().map((module) => ({
      name: module.name,
      healthy: module.healthCheck ? module.healthCheck() : true,
    }));
  }
}
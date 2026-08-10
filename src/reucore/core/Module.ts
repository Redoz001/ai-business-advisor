import { ReuCoreMessage } from "./Coordinator";

export interface ModuleContext {
  send(
    type: string,
    payload?: unknown,
    source?: string
  ): Promise<void>;

  getModule<T = unknown>(name: string): T | undefined;

  isEngineRunning(): boolean;
}

export interface ReuCoreModule {
  readonly name: string;

  initialize?(context: ModuleContext): Promise<void> | void;

  start?(): Promise<void> | void;

  stop?(): Promise<void> | void;

  onMessage?(message: ReuCoreMessage): Promise<void> | void;

  healthCheck?(): boolean;
}
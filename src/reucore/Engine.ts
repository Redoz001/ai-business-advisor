import {
  Coordinator,
  LoggerModule,
  ReasoningModule,
  SceneBlueprintModule,
  SVGRendererModule,
} from "./index";

export async function createReuCore() {
  const engine = new Coordinator();

  await engine.register(new LoggerModule());
  await engine.register(new ReasoningModule());
  await engine.register(new SceneBlueprintModule());
  await engine.register(new SVGRendererModule());

  await engine.start();

  return engine;
}
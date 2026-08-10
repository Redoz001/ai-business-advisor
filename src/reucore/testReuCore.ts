import { Coordinator, ReasoningModule, LoggerModule } from "./index";

export async function testReuCore() {
  const engine = new Coordinator();

  await engine.register(new LoggerModule());
  await engine.register(new ReasoningModule());

  await engine.start();

  await engine.send(
    "PROMPT_RECEIVED",
    "A cinematic futuristic AI poster for ReuNexus",
    "test"
  );

  return engine.healthCheck();
}
export class StreamingService {
  static streamText(
    text: string,
    onUpdate: (value: string) => void,
    speed = 12,
    signal?: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!text) {
        onUpdate("");
        resolve();
        return;
      }

      let index = 0;

      const stopWithAbort = () => {
        window.clearInterval(interval);
        reject(new DOMException("Generation stopped.", "AbortError"));
      };

      const interval = window.setInterval(() => {
        if (signal?.aborted) {
          stopWithAbort();
          return;
        }

        index += 1;
        onUpdate(text.slice(0, index));

        if (index >= text.length) {
          window.clearInterval(interval);
          signal?.removeEventListener("abort", stopWithAbort);
          resolve();
        }
      }, speed);

      signal?.addEventListener("abort", stopWithAbort, {
        once: true,
      });
    });
  }
}

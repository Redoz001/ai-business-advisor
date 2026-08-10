import { useCallback } from "react";

import { StreamingService } from "../services/StreamingService";

export function useStreaming() {
  const stream = useCallback(
    (
      text: string,
      onUpdate: (value: string) => void,
      signal?: AbortSignal
    ) => {
      return StreamingService.streamText(
        text,
        onUpdate,
        12,
        signal
      );
    },
    []
  );

  return {
    stream,
  };
}

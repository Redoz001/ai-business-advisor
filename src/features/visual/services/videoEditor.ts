import { parseVideoEditInstructions } from "../../../services/visualPrompting.js";

function waitForMediaEvent(media: HTMLVideoElement, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      media.removeEventListener(eventName, onReady);
      media.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      media.removeEventListener(eventName, onReady);
      media.removeEventListener("error", onError);
      reject(new Error("The uploaded video could not be decoded."));
    };
    media.addEventListener(eventName, onReady, { once: true });
    media.addEventListener("error", onError, { once: true });
  });
}

export async function editUploadedVideo(file: File, instruction: string): Promise<Blob> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Choose a video file to edit.");
  }
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser cannot render video edits. Try a current version of Chrome or Edge.");
  }

  const edits = parseVideoEditInstructions(instruction);
  if (
    edits.filters.length === 0 &&
    edits.speed === 1 &&
    edits.trimStartSeconds === 0 &&
    edits.trimEndSeconds === null &&
    !edits.caption
  ) {
    throw new Error("Try a supported edit: black and white, sepia, brighter, slower, trim from 2 seconds, or caption: your text.");
  }

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  video.muted = false;
  video.src = sourceUrl;

  let audioContext: AudioContext | null = null;
  let animationFrame = 0;
  let recorder: MediaRecorder | null = null;
  let outputStream: MediaStream | null = null;

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const duration = video.duration;
    const startAt = Math.min(edits.trimStartSeconds, Math.max(0, duration - 0.1));
    const endAt = Math.min(edits.trimEndSeconds ?? duration, duration);
    if (endAt <= startAt) {
      throw new Error("The requested trim range does not contain any video.");
    }

    video.currentTime = startAt;
    if (video.seeking) await waitForMediaEvent(video, "seeked");

    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create a video editing canvas.");

    const videoStream = canvas.captureStream(30);
    outputStream = new MediaStream(videoStream.getVideoTracks());

    const AudioContextClass = window.AudioContext;
    if (AudioContextClass && typeof video.captureStream === "function") {
      audioContext = new AudioContextClass();
      const audioSource = audioContext.createMediaElementSource(video);
      const audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      audioDestination.stream.getAudioTracks().forEach((track) => outputStream?.addTrack(track));
      await audioContext.resume();
    } else if (typeof video.captureStream === "function") {
      video.captureStream().getAudioTracks().forEach((track) => outputStream?.addTrack(track));
    }

    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) throw new Error("This browser does not support WebM video export.");

    const chunks: BlobPart[] = [];
    recorder = new MediaRecorder(outputStream, { mimeType });
    const recordingFinished = new Promise<Blob>((resolve, reject) => {
      recorder!.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder!.addEventListener("error", () => reject(new Error("Video export failed.")), { once: true });
      recorder!.addEventListener("stop", () => resolve(new Blob(chunks, { type: mimeType })), { once: true });
    });

    const drawFrame = () => {
      context.filter = edits.filters.join(" ") || "none";
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.filter = "none";

      if (edits.caption) {
        const fontSize = Math.max(20, Math.round(canvas.width * 0.045));
        context.font = `600 ${fontSize}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillStyle = "rgba(0, 0, 0, 0.58)";
        context.fillRect(0, canvas.height - fontSize * 2.2, canvas.width, fontSize * 2.2);
        context.fillStyle = "#ffffff";
        context.fillText(edits.caption.slice(0, 120), canvas.width / 2, canvas.height - fontSize * 0.6, canvas.width * 0.9);
      }

      if (video.currentTime >= endAt || video.ended) {
        video.pause();
        if (recorder?.state === "recording") recorder.stop();
        return;
      }
      animationFrame = requestAnimationFrame(drawFrame);
    };

    video.playbackRate = edits.speed;
    recorder.start(250);
    await video.play();
    drawFrame();

    return await recordingFinished;
  } finally {
    cancelAnimationFrame(animationFrame);
    if (recorder?.state === "recording") recorder.stop();
    outputStream?.getTracks().forEach((track) => track.stop());
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (audioContext) await audioContext.close();
    URL.revokeObjectURL(sourceUrl);
  }
}
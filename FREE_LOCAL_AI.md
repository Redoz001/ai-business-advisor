# Free Local AI

Ollama is the no-per-request-cost option. It runs models on your own computer, so there is no API bill or generation quota. Hardware, electricity, disk space, and speed are the limits.

## Chat setup

1. Install Ollama from https://ollama.com/download.
2. Download a general model:

```powershell
ollama pull qwen2.5:7b
```

For a lower-memory computer, use `qwen2.5:3b` and set `OLLAMA_MODEL=qwen2.5:3b`.

3. Configure the function environment:

```env
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

This works when the function runs locally beside Ollama. A hosted Supabase function cannot reach your computer's `localhost`; use a private authenticated HTTPS gateway or run the function locally.

For a laptop that is not always on, use the browser's hybrid mode:

```env
VITE_LOCAL_AI=true
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3
VITE_LOCAL_AI_ONLY=false
```

The app uses Ollama when the laptop is available and automatically falls back to the hosted AI route when it is offline. The hosted route still requires a configured provider and may have usage limits.

## Free Mesh mode

Enable this setting as well:

```env
VITE_FREE_MESH=true
```

The browser stores up to 100 successful text answers locally. Repeated questions are answered from the local cache without contacting any model. New questions use Ollama when available, then the hosted fallback when the laptop is off.

## Images and video

Ollama is a text model, not an image or video model. The app keeps its browser visual fallback, which is free but not comparable to premium image models. Truly unlimited realistic local images require a local GPU workflow such as ComfyUI with Stable Diffusion or FLUX. Realistic local video requires substantially more GPU memory and storage.

Never commit API keys or service-role keys. Rotate credentials that were previously stored in tracked files.

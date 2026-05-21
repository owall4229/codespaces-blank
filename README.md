# Local GPT4All Assistant

This workspace contains a local GPT4All chat assistant with a browser-based UI and optional open-source image generation via Stable Diffusion.

## Setup

1. Install dependencies:

```bash
python3 -m pip install -r requirements.txt
```

2. Run the web server:

```bash
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

3. Open `http://127.0.0.1:8000` in your browser.

## Features

- Local chat using GPT4All
- User authentication with register/login
- Chat list, delete chat, and AI-generated titles
- Markdown rendering with code blocks and LaTeX support
- Open-source image generation using Stable Diffusion

## Image Generation

The backend uses `diffusers` and `torch` to generate images from prompts.

Optional environment variables:

- `HUGGINGFACE_TOKEN`: recommended for faster access to Hugging Face models and higher download limits
- `IMAGE_MODEL`: override the default Stable Diffusion model (default: `runwayml/stable-diffusion-v1-5`)

The app loads the image model lazily on first request to reduce startup memory usage.

## Notes

- The first run may download the GPT4All model and, on demand, the Stable Diffusion image model.
- If you only want chat, you can skip image generation by not using the image prompt feature.
- The image model is large and may require several gigabytes of disk space and enough RAM to load.
- `torchvision` is required for the default image processor backend.

## Environment Variables

You can customize behavior with these variables:

```bash
export GPT4ALL_MODEL="Llama-3.2-1B-Instruct-Q4_0.gguf"
export IMAGE_MODEL="runwayml/stable-diffusion-v1-5"
export HUGGINGFACE_TOKEN="your_token_here"
export SESSION_SECRET="replace-this-with-a-secure-string"
```

## Local CLI

This repository also includes a basic CLI helper:

```bash
python3 local_gpt4all.py
```

That script uses the GPT4All model locally and is useful if you do not want to run the web UI.

## Troubleshooting

- If the app prints `CLIPImageProcessor requires torchvision`, install `torchvision`.
- If model downloads are killed, check available disk space and memory.
- If you encounter authentication issues, make sure `SESSION_SECRET` is set in your environment.

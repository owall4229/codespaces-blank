# Local GPT4All Assistant

This workspace contains a small local GPT4All setup using the `gpt4all` Python package.

## Setup

1. Install dependencies:

```bash
python3 -m pip install -r requirements.txt
```

2. Run the CLI assistant:

```bash
python3 local_gpt4all.py
```

The first run will automatically download the `mistral-7b-instruct-v0.1.Q4_0.gguf` model to `~/.cache/gpt4all/`.

## Web UI

Install the web dependencies and run the server:

```bash
python3 -m pip install -r requirements.txt
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000` in your browser.

The first web request may take a bit longer while the model loads.

## Usage

- Type any prompt and press Enter.
- Use `exit`, `quit`, or `q` to stop.

## Notes

- This is a local model and does not require an expensive external API key.
- The script forces CPU mode so the missing CUDA libraries are ignored on systems without NVIDIA GPU support.
- The model file is about 773 MB and may take a few minutes to download on first run.

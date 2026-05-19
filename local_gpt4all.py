from __future__ import annotations

import argparse
import os
import sys
from contextlib import redirect_stderr
from pathlib import Path
from typing import List

with open(os.devnull, "w") as _null_stderr:
    with redirect_stderr(_null_stderr):
        from gpt4all import GPT4All

MODEL_NAME = "mistral-7b-instruct-v0.1.Q4_0.gguf"
CACHE_DIR = Path.home() / ".cache" / "gpt4all"
SYSTEM_PROMPT = "You are a helpful local AI assistant. Answer clearly and accurately."


def build_prompt(history: List[tuple[str, str]], user_input: str) -> str:
    prompt_lines = [f"### System: {SYSTEM_PROMPT}\n"]
    for user, assistant in history:
        prompt_lines.append(f"### Human: {user}\n")
        prompt_lines.append(f"### Assistant: {assistant}\n")
    prompt_lines.append(f"### Human: {user_input}\n")
    prompt_lines.append("### Assistant: ")
    return "".join(prompt_lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a local GPT4All-based assistant.")
    parser.add_argument("--model", default=MODEL_NAME, help="GPT4All model filename to use.")
    parser.add_argument("--max-tokens", type=int, default=256, help="Maximum tokens generated per response.")
    parser.add_argument("--temp", type=float, default=0.7, help="Sampling temperature for generation.")
    parser.add_argument("--n-batch", type=int, default=8, help="Batch size for model inference.")
    parser.add_argument("--no-history", action="store_true", help="Do not keep conversation history between turns.")
    args = parser.parse_args()

    print("Local GPT4All assistant starting...")
    print("Model: ", args.model)
    print("If this is the first run, the model will download automatically.")
    print("Type 'exit' or 'quit' to stop.\n")
    print("Note: On CPU-only systems, GPT4All may print optional CUDA loader warnings even though it will run on CPU.\n")

    model = GPT4All(
        model_name=args.model,
        model_path=CACHE_DIR,
        allow_download=True,
        device="cpu",
    )

    history: List[tuple[str, str]] = []

    try:
        while True:
            user_input = input("You: ").strip()
            if not user_input:
                continue
            if user_input.lower() in {"exit", "quit", "q"}:
                print("Goodbye.")
                break

            prompt = build_prompt(history, user_input)
            response = model.generate(
                prompt,
                max_tokens=args.max_tokens,
                temp=args.temp,
                top_k=40,
                top_p=0.4,
                repeat_penalty=1.18,
                repeat_last_n=64,
                n_batch=args.n_batch,
            )
            response_text = response.strip()
            print(f"Assistant: {response_text}\n")

            if not args.no_history:
                history.append((user_input, response_text))
                if len(history) > 8:
                    history = history[-8:]
    finally:
        model.close()


if __name__ == "__main__":
    main()

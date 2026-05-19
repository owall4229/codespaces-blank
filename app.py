from __future__ import annotations

import hashlib
import json
import os
import secrets
import sys
import threading
from contextlib import contextmanager, redirect_stderr
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import (
    Depends,
    FastAPI,
    Form,
    HTTPException,
    Request,
    status,
)
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

@contextmanager
def suppress_stderr() -> Any:
    stderr_fd = sys.stderr.fileno()
    with open(os.devnull, 'w') as devnull:
        saved_stderr = os.dup(stderr_fd)
        os.dup2(devnull.fileno(), stderr_fd)
        try:
            yield
        finally:
            os.dup2(saved_stderr, stderr_fd)
            os.close(saved_stderr)

with open(os.devnull, 'w') as _devnull:
    with redirect_stderr(_devnull):
        from gpt4all import GPT4All

BASE_DIR = Path(__file__).resolve().parent
USERS_FILE = BASE_DIR / "users.json"
CACHE_DIR = Path.home() / ".cache" / "gpt4all"
MODEL_NAME = os.environ.get("GPT4ALL_MODEL", "Llama-3.2-1B-Instruct-Q4_0.gguf")
SYSTEM_PROMPT = "You are a sophisticated local AI assistant. Respond helpfully, accurately, and with a friendly tone."
SECRET_KEY = os.environ.get("SESSION_SECRET", "change-me-in-production")

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        220_000,
        dklen=32,
    )
    return salt, digest.hex()


def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    _, hashed = hash_password(password, salt)
    return secrets.compare_digest(hashed, stored_hash)


def load_users() -> dict[str, Any]:
    if not USERS_FILE.exists():
        USERS_FILE.write_text(json.dumps({}), encoding="utf-8")
    return json.loads(USERS_FILE.read_text(encoding="utf-8"))


def save_users(data: dict[str, Any]) -> None:
    USERS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_current_user(request: Request) -> str | None:
    user = request.session.get("user")
    return user if isinstance(user, str) else None


def build_prompt(history: list[dict[str, str]], user_input: str) -> str:
    prompt = [f"### System: {SYSTEM_PROMPT}\n"]
    for message in history:
        role = message["role"]
        content = message["content"]
        if role == "user":
            prompt.append(f"### Human: {content}\n")
        else:
            prompt.append(f"### Assistant: {content}\n")
    prompt.append(f"### Human: {user_input}\n")
    prompt.append("### Assistant: ")
    return "".join(prompt)


def create_gpt4all() -> GPT4All:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with suppress_stderr():
        return GPT4All(
            model_name=MODEL_NAME,
            model_path=CACHE_DIR,
            allow_download=True,
            device="cpu",
            n_threads=min(4, os.cpu_count() or 1),
        )

@app.on_event("startup")
def startup_event() -> None:
    if not USERS_FILE.exists():
        save_users({})
    app.state.model_lock = threading.Lock()
    app.state.gpt4all = create_gpt4all()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    if hasattr(app.state, "gpt4all"):
        app.state.gpt4all.close()


def require_user(request: Request) -> str:
    user = get_current_user(request)
    if user is None:
        raise HTTPException(status_code=status.HTTP_303_SEE_OTHER, headers={"Location": "/login"})
    return user


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    user = get_current_user(request)
    if user:
        return RedirectResponse(url="/chat")
    return RedirectResponse(url="/login")


@app.get("/login", response_class=HTMLResponse)
def login_get(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("login.html", {"request": request, "error": None})


@app.post("/login", response_class=HTMLResponse)
def login_post(request: Request, username: str = Form(...), password: str = Form(...)) -> HTMLResponse:
    users = load_users()
    credentials = users.get(username)
    if not credentials or not verify_password(password, credentials["salt"], credentials["hash"]):
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Invalid username or password."},
        )

    request.session["user"] = username
    request.session["history"] = []
    return RedirectResponse(url="/chat", status_code=status.HTTP_303_SEE_OTHER)


@app.get("/register", response_class=HTMLResponse)
def register_get(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("register.html", {"request": request, "error": None})


@app.post("/register", response_class=HTMLResponse)
def register_post(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
) -> HTMLResponse:
    if password != password_confirm:
        return templates.TemplateResponse(
            "register.html",
            {"request": request, "error": "Passwords do not match."},
        )

    users = load_users()
    if username in users:
        return templates.TemplateResponse(
            "register.html",
            {"request": request, "error": "Username already exists."},
        )

    salt, hashed = hash_password(password)
    users[username] = {
        "salt": salt,
        "hash": hashed,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    save_users(users)
    request.session["user"] = username
    request.session["history"] = []
    return RedirectResponse(url="/chat", status_code=status.HTTP_303_SEE_OTHER)


@app.get("/logout")
def logout(request: Request) -> RedirectResponse:
    request.session.clear()
    return RedirectResponse(url="/login")


@app.get("/chat", response_class=HTMLResponse)
def chat_page(request: Request, user: str = Depends(require_user)) -> HTMLResponse:
    return templates.TemplateResponse(
        "chat.html",
        {
            "request": request,
            "user": user,
            "history": request.session.get("history", []),
        },
    )


def generate_chat_response(request: Request, prompt: str) -> str:
    """Generate a full assistant response and update session history."""
    history = request.session.get("history", [])
    if not isinstance(history, list):
        history = []

    formatted_prompt = build_prompt(history, prompt)
    with app.state.model_lock:
        assistant_text = app.state.gpt4all.generate(
            formatted_prompt,
            max_tokens=350,
            temp=0.75,
            top_k=40,
            top_p=0.4,
            repeat_penalty=1.18,
            repeat_last_n=64,
            n_batch=8,
            streaming=False,
        )

    history.append({"role": "user", "content": prompt})
    history.append({"role": "assistant", "content": assistant_text})
    request.session["history"] = history[-12:]

    return assistant_text


@app.post("/api/chat")
def api_chat(request: Request, prompt: str = Form(...), user: str = Depends(require_user)) -> PlainTextResponse:
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    try:
        assistant_text = generate_chat_response(request, prompt)
        return PlainTextResponse(assistant_text, media_type="text/plain; charset=utf-8")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

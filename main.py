import os
import time
import hashlib
import json
from urllib import request, error
from pathlib import Path

SAVE_DIR = os.path.expanduser("~/Retroarch/saves")
SERVER_URL = "http://localhost:8000"
DEVICE_NAME = "my-retroid"
POLL_EVERY = 5
STATE_FILE = ".syncrhonite_state.json"

def load_state() -> dict:
    path = Path(SAVE_DIR) / STATE_FILE 
    if path.exists():
        return json.loads(path.read_text())
    return {}

def save_state(state: dict) -> None:
    path = Path(SAVE_DIR) / STATE_FILE
    path.write_text(json.dumps(state, indent=2))

def hash_file(filepath: str) -> str:
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
          h.update(chunk)
    return h.hexdigest()

def post_file(file_path: str, file_name: str) -> bool:
    """Upload a save file to the server. Return true on success."""
    url = f"{SERVER_URL}/saves/upload"
    with open(file_path, "rb") as f:
        f.read()

    boundary = "----SynchroniteBoundary"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data name; name="device"\r\n\r\n'
        f"{DEVICE_NAME}\r\n"
    )  

 

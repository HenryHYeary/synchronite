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

def post_file(filepath: str, filename: str) -> bool:
    """Upload a save file to the server. Return true on success."""
    url = f"{SERVER_URL}/saves/upload"
    with open(filepath, "rb") as f:
        data = f.read()

    boundary = "----SynchroniteBoundary"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data name; name="device"\r\n\r\n'
        f"{DEVICE_NAME}\r\n"
        f'Content-Disposition: form-data; name="file"; filename={filename}\r\n'
        f'Content-Type: application/octet-stream\r\n\r\n'
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()

    req = request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=10) as res:
            return res.status == 200
    except error.URLError as e:
        print(f"Upload failed for {filename}: {e}")
        return False

def get_remote_saves() -> list[dict]:
    """Ask the server for all of the saves it is aware of on this device."""
    url = f"{SERVER_URL}/saves?device={DEVICE_NAME}"
    try:
        with request.urlopen(url, timeout=10) as res:
            return json.loads(res.read())
    except error.URLError as e:
        print(f"Could not reach server: {e}")
        return []

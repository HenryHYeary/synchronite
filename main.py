import os
import time
import hashlib
import json
from urllib import request, error
from pathlib import Path

SAVE_DIR = os.path.expanduser("~/Documents/RetroArch/saves")
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

def download_file(save_id: str, dest_path: str) -> bool:
    """Download a save file from the server."""
    url = f"{SERVER_URL}/saves/{save_id}/download"
    try:
        with request.urlopen(url, timeout=10) as res:
            Path(dest_path).write_bytes(res.read())
        return True
    except error.URLError as e:
        print(f"Download failed: {e}")
        return False

def scan_saves() -> dict[str, str]:
    """Return { filename, hash } for all save files in SAVE_DIR."""
    saves = {}
    for ext in ("*.srm", "*.sav", "*.state", "*.mcr"):
        for path in Path(SAVE_DIR).glob(ext):
            if path.name == STATE_FILE:
                continue
            saves[path.name] = hash_file(str(path))
    return saves

def sync_on_startup(state: dict) -> dict:
    """
    On startup pull down anything from the server that's newer
    than what is stored locally.
    """
    print("Checking for remote saves.")
    remote_saves = get_remote_saves()
    if not remote_saves:
        return state

    for remote in remote_saves:
        filename = remote["filename"]
        save_id = remote["id"]
        dest_path = Path(str(SAVE_DIR) / filename)
        local_exists = Path(dest_path).exists()

        if not local_exists:
            print(f"Downloading new save: {filename}")
            if download_file(dest_path, save_id):
                state[filename] = hash_file(dest_path)
    
    return state

def check_for_changes(state: dict) -> dict:
    """
    Scan the save directory, upload anything that changed since last check.
    Return updated save.
    """
    current = scan_saves()

    for filename, current_hash in current.items():
        last_hash = state.get(filename)
        
        if last_hash is None:
            print(f"New save filedetected: {filename}")
            if post_file(str(Path(SAVE_DIR) / filename), filename):
                state[filename] = current_hash
    
    return state

def main():
    print("Synchronite agent starting...")
    print(f"Watching: {SAVE_DIR}")
    print(f"Server: {SERVER_URL}")
    print(f"Device: {DEVICE_NAME}\n")

    if not Path(SAVE_DIR).exists():
        print(f"Save directory not found: {SAVE_DIR}")
        return
    
    state = load_state()
    state = sync_on_startup(state)
    save_state(state)

    print(f"Watching for saves every {POLL_EVERY}s (Ctrl + C to stop)\n")
    try:
        while True:
            state = check_for_changes(state)
            save_state(state)
            time.sleep(POLL_EVERY)
    except KeyboardInterrupt:
        print("\nAgent stopped.")
        save_state(state)

if __name__ == "__main__":
    main()


import time
import uuid
import json
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException

UPLOAD_DIR = Path("./server_saves")
INDEX_FILE = UPLOAD_DIR / "index.json"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def load_index() -> list[dict]:
    if INDEX_FILE.exists():
        return json.loads(INDEX_FILE.read_text())
    return []

def save_index(index: list[dict]) -> None:
    INDEX_FILE.write_text(json.dumps(index, indent=2))

app = FastAPI(title="Synchronite", version="0.2.0")

@app.post("saves/upload")
async def upload_save(
    device: str = Form(...),
    file: UploadFile = File(...)
):
    data = await file.read()
    index = load_index()
    save_id = str(uuid.uuid4())
    stored_name = f"{save_id}_{file.filename}"
    stored_path = UPLOAD_DIR / stored_name
    stored_path.write_bytes(data)

    existing = next(
        (s for s in index if s["device"] == device and s["filename"] == file.filename),
        None
    )
    if existing:
        old = UPLOAD_DIR / existing["stored_name"]
        if old.exists():
            old.unlink()
        existing.update({
            "stored_name": stored_name,
            "uploaded_at": time.time(),
            "size": len(data)
        })
    else:
        index.append({
            "id": save_id,
            "filename": file.filename,
            "device": device,
            "stored_name": stored_name,
            "uploaded_at": time.time(),
            "size": len(data)
        })

    save_index(index)
    print(f"Saved {file.filename} from {device} ({len(data)} bytes)")
    return { "status": "ok", "id": save_id }

@app.get("/saves")
def list_saves(device: str | None = None, save_type: str | None = None):
    index = load_index()
    

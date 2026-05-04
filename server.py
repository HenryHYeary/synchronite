import time
import uuid
import json
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

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
def list_saves(device: str | None = None, save_type: str | None = None) -> list[dict]:
    index = load_index()
    if device:
        index = [s for s in index if s["device"] == device]
    if save_type:
        index = [s for s in index if s.get("save_type") == save_type]
    return [{k: v for k, v in s.items() if k != "stored_name"} for s in index]

@app.get("/saves/{save_id}/download")
def download_save(save_id: str):
    index = load_index()
    record = next((s for s in index if s["id"] == save_id), None)

    if not record:
        raise HTTPException(status_code=404, detail="Save not found")

    path = UPLOAD_DIR / record["stored_name"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")

    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=record["filename"]
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Synchronite", host="0.0.0.0", port=3000, reload=True)

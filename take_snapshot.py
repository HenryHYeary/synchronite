from hashlib import sha256
from pathlib import Path
import os
import sys
import json
from argparse import ArgumentParser

if sys.platform == "win32":
    DEFAULT_PATH = Path(os.environ["APPDATA"]) / "RetroArch" / "saves"
elif sys.platform == "darwin":
    DEFAULT_PATH = Path("~/Documents/RetroArch/saves").expanduser()
else:
    DEFAULT_PATH = Path("~/.config/retroarch/saves").expanduser()

parser = ArgumentParser(description="Cloud save synchronizer for RetroArch.")
parser.add_argument(
    "-p",
    type=Path,
    default=DEFAULT_PATH,
    help=f"Path to RetroArch saves directory (default: {DEFAULT_PATH})"
)

# Absolute paths of saves
def find_saves(start_path):
    return [ entry for entry in start_path.rglob("*") if entry.suffix == ".srm" ]

def hash_save(save):
    sha256_hash = sha256()
    with open(save, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

# Relative path, file size, mtime
def get_json_snapshot(start_path):
    saves = find_saves(start_path)
    snapshot = {}
    for save in saves:
        save_stats = save.stat()
        snapshot[str(save.relative_to(start_path))] = {
            "size": save_stats.st_size,
            "mtime": save_stats.st_mtime,
            "checksum": hash_save(save),
        }
    
    return snapshot


if __name__ == "__main__":
    args = parser.parse_args()
    path = args.p
    with open("manifest.json", "w") as f:
        json.dump(get_json_snapshot(path), f, indent=4, sort_keys=True)
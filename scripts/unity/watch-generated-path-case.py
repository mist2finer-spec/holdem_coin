"""Local Unity 6000.0/exFAT workaround for case-mismatched source-generator roots.

Run before opening the Editor. Only case in generated UnityAdditionalFile.txt
files is adjusted; project files, CWD and Unity assemblies are never changed.
Exits with the Editor. A per-project OS lock prevents duplicate watchers.
"""
import argparse
import ctypes
import json
import msvcrt
import os
import pathlib
import time

parser = argparse.ArgumentParser()
parser.add_argument("--project", required=True)
args = parser.parse_args()
project = pathlib.Path(args.project).resolve(strict=True)
assert (project / "ProjectSettings/ProjectVersion.txt").is_file()
library = project / "Library"
library.mkdir(exist_ok=True)
lock = (library / "canonical-script-path-watch.lock").open("a+b")
lock.seek(0)
try:
    msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
except OSError:
    raise SystemExit(0)

kernel = ctypes.WinDLL("kernel32", use_last_error=True)
kernel.OpenProcess.restype = ctypes.c_void_p
kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
kernel.CloseHandle.argtypes = [ctypes.c_void_p]

def running(pid):
    handle = kernel.OpenProcess(0x00100000, False, pid)
    if not handle:
        return False
    alive = kernel.WaitForSingleObject(handle, 0) == 258
    kernel.CloseHandle(handle)
    return alive

started = time.monotonic()
seen_editor = False
stamps = {}
repairs = 0
def inputs():
    # DirEntry carries Windows find-data timestamps, avoiding a disk stat per file.
    try:
        with os.scandir(library / "Bee/artifacts") as groups:
            for group in groups:
                if not group.is_dir():
                    continue
                with os.scandir(group.path) as entries:
                    for entry in entries:
                        if entry.name.endswith(".UnityAdditionalFile.txt"):
                            yield pathlib.Path(entry.path), entry.stat().st_mtime_ns
    except OSError:
        return

while True:
    try:
        pid = json.loads((library / "EditorInstance.json").read_text())["process_id"]
        alive = running(pid)
    except (OSError, ValueError, KeyError):
        alive = False
    if alive:
        seen_editor = True
    elif seen_editor or time.monotonic() - started > 180:
        break
    for path, stamp in inputs():
        try:
            if stamps.get(path) == stamp:
                continue
            raw = path.read_bytes()
            text = raw.decode("utf-8-sig")
            root = text.strip()
            actual = str(project).replace("\\", "/" if "/" in root else "\\")
            if root.casefold() == actual.casefold() and root != actual:
                updated = text.replace(root, actual, 1).encode("utf-8")
                if raw.startswith(b"\xef\xbb\xbf"):
                    updated = b"\xef\xbb\xbf" + updated
                # Same-length overwrite avoids an empty/truncated read by Roslyn.
                if len(updated) == len(raw):
                    with path.open("r+b") as stream:
                        if stream.read() == raw:
                            stream.seek(0)
                            stream.write(updated)
                            repairs += 1
                    (library / "canonical-script-path-watch.json").write_text(
                        json.dumps({"repairs": repairs, "last": path.name, "root": actual})
                    )
            stamps[path] = path.stat().st_mtime_ns
        except (OSError, UnicodeError):
            pass  # Unity may be replacing an input; retry on the next scan.
    time.sleep(0.1)

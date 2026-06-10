#!/usr/bin/env python3

import base64
import json
import mimetypes
import os
import re
import sys
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT_DIR / "mock_uploads"
DEFAULT_PORT = 8000


def sanitize_filename(name: str) -> str:
    base = Path(name or "upload").name
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base).strip(".-") or "upload"
    return base


def guess_extension(file_name: str, mime_type: str) -> str:
    suffix = Path(file_name or "").suffix
    if suffix:
        return suffix
    guessed = mimetypes.guess_extension(mime_type or "")
    return guessed or ".bin"


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/mock/report-upload":
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode("utf-8"))
            file_name = str(payload.get("fileName") or "report-photo")
            mime_type = str(payload.get("mimeType") or "application/octet-stream")
            base64_data = str(payload.get("base64Data") or "").strip()
            if not base64_data:
                raise ValueError("base64Data is required")

            UPLOAD_DIR.mkdir(exist_ok=True)
            safe_name = sanitize_filename(file_name)
            extension = guess_extension(safe_name, mime_type)
            stem = Path(safe_name).stem or "report-photo"
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            final_name = f"{stamp}-{stem}{extension}"
            file_path = UPLOAD_DIR / final_name
            file_path.write_bytes(base64.b64decode(base64_data))

            host = self.headers.get("Host") or f"localhost:{self.server.server_port}"
            file_url = f"http://{host}/mock_uploads/{final_name}"
            response = {
                "ok": True,
                "mode": "mock",
                "imageUrl": file_url,
                "driveShareUrl": file_url,
                "imageFileId": final_name,
                "savedPath": str(file_path.relative_to(ROOT_DIR)),
                "message": "Mock upload completed"
            }
            self.send_json(response, HTTPStatus.OK)
        except Exception as exc:
            self.send_json({
                "ok": False,
                "error": str(exc),
                "mode": "mock"
            }, HTTPStatus.BAD_REQUEST)

    def send_json(self, payload, status):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(os.environ.get("PORT") or DEFAULT_PORT)
    server = ThreadingHTTPServer(("127.0.0.1", port), PreviewHandler)
    print(f"Serving {ROOT_DIR} at http://127.0.0.1:{port}")
    print("Mock upload endpoint: /mock/report-upload")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server")
    finally:
        server.server_close()


if __name__ == "__main__":
    sys.exit(main())

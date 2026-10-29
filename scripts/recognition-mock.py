"""提供固定辨識結果，供本機測試最佳與次佳選項。照片不送交模型。"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

FIXTURE = Path(__file__).resolve().parents[1] / "tests/fixtures/recognition-alternative.json"


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # 讀取並丟棄上傳內容。測試結果不依照片內容改變。
        self.rfile.read(int(self.headers.get("Content-Length", "0")))
        if self.path != "/api/predict":
            self.send_error(404)
            return
        payload = FIXTURE.read_bytes()
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    print("測試辨識 API：http://127.0.0.1:8011/api/predict", flush=True)
    HTTPServer(("127.0.0.1", 8011), Handler).serve_forever()

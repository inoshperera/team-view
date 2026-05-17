from http.server import BaseHTTPRequestHandler, HTTPServer
import requests

API_KEY = "1d628ca97bac57d7d563b4200e852a37d91e7813"
REDMINE_URL = "https://roadmap.entgra.net"

class Proxy(BaseHTTPRequestHandler):

    # ---- FIX: Handle OPTIONS preflight ----
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "x-redmine-api-key, Content-Type")
        self.end_headers()

    # ---- Handle GET ----
    def do_GET(self):
        target_url = f"{REDMINE_URL}{self.path}"
        print("FORWARDING TO:", target_url)

        try:
            resp = requests.get(target_url, headers={"X-Redmine-API-Key": API_KEY})
            
            self.send_response(resp.status_code)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(resp.content)

        except Exception as e:
            print("ERROR:", e)
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"Proxy error")

server = HTTPServer(("localhost", 9000), Proxy)
print("Proxy running at http://localhost:9000")
server.serve_forever()

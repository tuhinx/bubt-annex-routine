import http.server
import socketserver
import webbrowser
import os

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

print(f"[*] Starting local server on http://localhost:{PORT}")
print("[*] Press Ctrl+C to stop.")

# Change directory to the workspace if not already there
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    # Open browser automatically
    webbrowser.open(f"http://localhost:{PORT}/index.html")
    httpd.serve_forever()

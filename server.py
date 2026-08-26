import http.server
import urllib.request
import urllib.parse
import traceback
import json
from socketserver import ThreadingMixIn

# Multi-threaded HTTP Server to handle parallel API requests without blocking
class ThreadingHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/proxy':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            target_url = query_params.get('url', [None])[0]
            if not target_url:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing url parameter")
                return
            
            try:
                decoded_url = urllib.parse.unquote(target_url)
                req = urllib.request.Request(
                    decoded_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/xml, text/xml, */*'
                    }
                )
                # Fetch directly from target URL on the local Python backend
                with urllib.request.urlopen(req, timeout=8) as response:
                    content = response.read()
                    self.send_response(200)
                    content_type = response.getheader('Content-Type', 'text/xml; charset=utf-8')
                    self.send_header('Content-Type', content_type)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(content)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        elif parsed_url.path == '/api/otterly':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            endpoint = query_params.get('endpoint', ['stats'])[0]
            report_id = query_params.get('reportId', ['01KZ32Y3BSH4E19NQHF9G31MGD'])[0]
            start_date = query_params.get('startDate', ['2026-08-01'])[0]
            end_date = query_params.get('endDate', ['2026-08-26'])[0]
            country = query_params.get('country', ['in'])[0]
            engines = query_params.get('engines', [])
            
            # Construct the target URL
            target_base = f"https://data.otterly.ai/v1/reports/brand/{report_id}/{endpoint}"
            
            # Prepare params
            params = {
                "startDate": start_date,
                "endDate": end_date,
                "country": country
            }
            if engines:
                params["engines"] = engines
            
            if endpoint == 'citations':
                limit = query_params.get('limit', ['10'])[0]
                params['limit'] = limit
                offset = query_params.get('offset', ['0'])[0]
                params['offset'] = offset
                
            query_str = urllib.parse.urlencode(params, doseq=True)
            target_url = f"{target_base}?{query_str}"
            
            try:
                import json
                req = urllib.request.Request(
                    target_url,
                    headers={
                        'Authorization': 'Bearer oai_live_cd8838563d31e8f46a3d32eb2bc87cb4900e20495f8f69e6312932d58ce35d3cdbcb70bf',
                        'Accept': 'application/json'
                    }
                )
                with urllib.request.urlopen(req, timeout=12) as response:
                    content = response.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(content)
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                try:
                    self.wfile.write(e.read())
                except:
                    self.wfile.write(str(e).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            super().do_GET()

if __name__ == '__main__':
    server_address = ('', 8080)
    httpd = ThreadingHTTPServer(server_address, ProxyHTTPRequestHandler)
    print("Serving on port 8080 with multi-threaded local /api/proxy backend...")
    httpd.serve_forever()

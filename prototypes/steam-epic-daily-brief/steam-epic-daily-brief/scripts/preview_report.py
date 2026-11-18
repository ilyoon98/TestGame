"""Build and serve a Steam report preview; images load directly from official Steam CDNs."""

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def build(data_path, output_path):
    data = json.loads(Path(data_path).read_text(encoding='utf-8-sig'))
    template = (Path(__file__).resolve().parents[1] / 'assets/report-preview.html').read_text(encoding='utf-8')
    payload = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
    result = template.replace('__REPORT_DATA__', payload)
    destination = Path(output_path).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(result, encoding='utf-8')
    return destination


def serve(report_path, port):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.split('?', 1)[0] not in ('/', '/report.html'):
                self.send_error(404)
                return
            content = report_path.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'REPORT_URL=http://127.0.0.1:{server.server_port}/report.html', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('data')
    parser.add_argument('output')
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    report = build(args.data, args.output)
    print(f'REPORT_FILE={report}', flush=True)
    if args.serve:
        serve(report, args.port)

"""Build and serve a Steam report preview; images load directly from official Steam CDNs."""

import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


KST = timezone(timedelta(hours=9))


def report_time(value):
    try:
        date = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None
    return date.astimezone(KST) if date.tzinfo else date.replace(tzinfo=KST)


def report_games(data):
    for group in data.get('groups', [data]):
        for kind in ('free', 'new', 'deals', 'alwaysFree'):
            for game in group.get(kind, []):
                match = re.search(r'/app/(\d+)(?:/|$|\?)', game.get('url', ''))
                if match:
                    yield (match[1], kind), game


def add_daily_changes(data, previous):
    current_at = report_time(data.get('asOf'))
    previous_at = report_time(previous.get('asOf'))
    if not current_at or not previous_at or previous_at.date() >= current_at.date():
        raise ValueError('The comparison report must have an earlier KST date.')

    previous_games = dict(report_games(previous))
    for (app_id, kind), game in report_games(data):
        before = previous_games.get((app_id, kind))
        if not before and kind == 'deals':
            former_new = previous_games.get((app_id, 'new'))
            if former_new and (former_new.get('discountPercent') or 0) > 0:
                before = former_new
        if not before and kind == 'alwaysFree':
            former_new = previous_games.get((app_id, 'new'))
            if former_new and former_new.get('priceVerified') is True and former_new.get('priceValue') == 0:
                before = former_new
        end = report_time(game.get('discountEnd'))
        verified = game.get('priceVerified') is True
        comparable = (
            before and verified and before.get('priceVerified') is True
            and game.get('edition') and game['edition'] == before.get('edition')
            and isinstance(game.get('priceValue'), int)
            and isinstance(before.get('priceValue'), int)
        )
        price_change = comparable and game['priceValue'] != before['priceValue']
        discount_change = comparable and all(
            isinstance(source.get('discountPercent'), int) for source in (game, before)
        ) and game['discountPercent'] != before['discountPercent']
        previous_end = report_time(before.get('discountEnd')) if before else None
        new_deadline = comparable and end and previous_end and abs(end - previous_end) >= timedelta(minutes=1)
        release_change = kind == 'new' and before and any(
            game.get(key) and before.get(key) and game[key] != before[key]
            for key in ('releaseDate', 'releaseState')
        )
        deadline_near = verified and end and current_at < end <= current_at + timedelta(days=7)
        updates = [
            label for changed, label in (
                (not before, 'added'),
                (price_change, 'price'),
                (discount_change and not price_change, 'discount'),
                (release_change, 'release'),
                (new_deadline, 'deadline'),
            ) if changed
        ]
        game['reportUpdates'] = updates
        game['dailyChange'] = bool(kind == 'free' or updates or deadline_near)
        if price_change:
            game['previousPriceValue'] = before['priceValue']
        else:
            game.pop('previousPriceValue', None)
    data['comparedAsOf'] = previous['asOf']


def build(data_path, output_path, previous_path=None):
    data = json.loads(Path(data_path).read_text(encoding='utf-8-sig'))
    if previous_path:
        previous = json.loads(Path(previous_path).read_text(encoding='utf-8-sig'))
        add_daily_changes(data, previous)
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
    parser.add_argument('--previous', help='Earlier KST report JSON for price comparison and ordering')
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    report = build(args.data, args.output, args.previous)
    print(f'REPORT_FILE={report}', flush=True)
    if args.serve:
        serve(report, args.port)

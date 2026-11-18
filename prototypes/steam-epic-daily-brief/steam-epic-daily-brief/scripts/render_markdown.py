"""Render a verified Steam report with native linked thumbnails; never download media."""

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit


def inline(value):
    value = re.sub(r"[\r\n\t]+", " ", str(value or ""))
    return re.sub(r"([\\`*_{}\[\]<>|])", r"\\\1", value)


def official_url(value, image=False, app_id=None):
    try:
        parsed = urlsplit(value)
        allowed = {
            "shared.akamai.steamstatic.com",
            "shared.fastly.steamstatic.com",
            "shared.cloudflare.steamstatic.com",
            "cdn.akamai.steamstatic.com",
            "cdn.cloudflare.steamstatic.com",
        } if image else {"store.steampowered.com", "steamcommunity.com"}
        if parsed.scheme != "https" or parsed.hostname not in allowed or parsed.username or parsed.password or parsed.port:
            return None
        if any(char in value for char in "\r\n\t<>() "):
            return None
        if image and app_id and f"/apps/{app_id}/" not in parsed.path:
            return None
        return value
    except (TypeError, ValueError):
        return None


def render(data):
    lines = [
        "**STEAM DAILY · 오늘의 게임 브리핑**",
        f"기준: {inline(data['asOf'])} KST / 대한민국  ",
        f"장르: {inline(' · '.join(data['genres']))} · 성인등급 {'포함' if data['includeMature'] else '제외'}",
        "",
    ]
    for highlight in data.get("highlights", [])[:3]:
        lines.append(f"- {inline(highlight)}")
    lines.append("")
    for key, label in [("free", "무료 배포"), ("new", "주목할 신작·출시 예정"), ("deals", "살펴볼 할인")]:
        lines.extend([f"**{label}**", ""])
        games = data.get(key, [])
        if not games:
            lines.extend([inline(data.get("emptyMessages", {}).get(key, "확인 결과 미입력")), ""])
        else:
            lines.extend(["| 게임·썸네일 | 가격·설명 |", "| --- | --- |"])
        for game in games:
            title = inline(game["title"])
            url = official_url(game.get("url"))
            app_match = re.search(r"/app/(\d+)(?:/|$)", urlsplit(url).path) if url else None
            thumbnail = official_url(game.get("thumbnailUrl"), image=True, app_id=app_match[1] if app_match else None)
            game_link = f"[{title}]({url})" if url else title
            media = f"[![{title} Steam 썸네일]({thumbnail})]({url})" if thumbnail and url and app_match else game_link
            price = inline(game.get("price") or "한국 가격 미확인")
            price_line = f"**{price}**"
            if game.get("originalPrice"):
                price_line = f"~~{inline(game['originalPrice'])}~~ → " + price_line
            if game.get("discount"):
                price_line += f" · **{inline(game['discount'])}**"
            info = [f"**{game_link}**", price_line, inline(game.get("description"))]
            details = [game.get(field) for field in ("status", "genre", "korean") if game.get(field)]
            if game.get("mature"):
                details.append("성인등급")
            if details:
                info.append(inline(" · ".join(details)))
            if game.get("deadline"):
                info.append(inline(game["deadline"]))
            if game.get("rating"):
                info.append(inline(game["rating"]))
            if game.get("note"):
                info.append(inline(game["note"]))
            lines.append(f"| {media} | {'<br>'.join(part for part in info if part)} |")
        if games:
            lines.append("")
    lines.extend(["**확인 범위**", "", inline(data.get("limits")), ""])
    for source in data.get("sources", []):
        if url := official_url(source.get("url")):
            lines.append(f"[{inline(source['label'])}]({url})  ")
    return "\n".join(lines).rstrip() + "\n"


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2:
        raise SystemExit("Usage: render_markdown.py REPORT.json")
    print(render(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))), end="")

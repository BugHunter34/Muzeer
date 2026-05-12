from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import os
from flask.cli import load_dotenv
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

load_dotenv()

def parse_csv_env(value, fallback=""):
    source = value or fallback
    return [entry.strip() for entry in source.split(",") if entry.strip()]

allowed_origins = parse_csv_env(
    os.getenv("MEDIA_CORS_ALLOWED_ORIGINS"),
    "http://localhost:5173"
)

CORS(app, resources={r"/*": {"origins": allowed_origins}})

YDL_OPTS = {
    "format": "bestaudio/best",
    "quiet": True,
    "noplaylist": True,
    "extract_flat": False,
    "extractor_args": {
        "youtube": {
            "player_client": ["android"]
        }
    }
}

def to_track_payload(info, fallback_query):
    video_id = info.get("id")

    thumbnail = (
        info.get("thumbnail")
        or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    )

    audio_url = info.get("url")

    return {
        "id": video_id,
        "title": info.get("title", fallback_query),
        "artist": info.get("uploader", "Unknown Artist"),
        "thumbnail": thumbnail,
        "duration": info.get("duration", 0),
        "webpage_url": info.get(
            "webpage_url",
            f"https://www.youtube.com/watch?v={video_id}"
        ),
        "audio_url": audio_url
    }

@app.route("/api/search", methods=["POST"])
def api_search():
    data = request.get_json(silent=True) or {}
    query = data.get("query")

    if not query:
        return jsonify({"error": "Missing query"}), 400

    try:
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            normalized_query = str(query).strip()

            if normalized_query.startswith(("http://", "https://")):
                info = ydl.extract_info(
                    normalized_query,
                    download=False
                )

                if "entries" in info:
                    results = [
                        to_track_payload(e, normalized_query)
                        for e in info["entries"]
                        if e
                    ]
                    return jsonify(results)

                return jsonify([
                    to_track_payload(info, normalized_query)
                ])

            search_info = ydl.extract_info(
                f"ytsearch10:{normalized_query} official audio",
                download=False
            )

            entries = (search_info or {}).get("entries") or []

            results = [
                to_track_payload(entry, normalized_query)
                for entry in entries
                if entry
            ]

            return jsonify(results)

    except Exception as e:
        print(f"Search Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/trending", methods=["GET"])
def api_trending():
    try:
        chart_url = "https://www.youtube.com/playlist?list=OLAK5uy_m3ud6eoJmyRFm7jnkVVctmbi9h8pDGJ7U"

        ydl_opts = {
            "quiet": True,
            "extract_flat": False,
            "playlistend": 8,
            "format": "bestaudio/best"
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(chart_url, download=False)

            entries = []

            if "entries" in result:
                for entry in result["entries"]:
                    if not entry:
                        continue

                    video_id = entry.get("id")

                    entries.append({
                        "id": video_id,
                        "title": entry.get("title"),
                        "artist": entry.get("uploader", "Unknown Artist"),
                        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                        "duration": entry.get("duration", 0),
                        "webpage_url": entry.get(
                            "webpage_url",
                            f"https://www.youtube.com/watch?v={video_id}"
                        ),
                        "audio_url": entry.get("url")
                    })

            return jsonify(entries)

    except Exception as e:
        print(f"Trending Error: {e}")
        return jsonify([])

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("MEDIA_PORT", "5000"))
    )
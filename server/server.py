from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp
import requests
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

    base_url = request.host_url.rstrip("/")
    proxy_url = f"{base_url}/api/stream?vid={video_id}"

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
        "audio_url": audio_url,
        "proxy_url": proxy_url 
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
            base_url = request.host_url.rstrip("/")

            if "entries" in result:
                for entry in result["entries"]:
                    if not entry:
                        continue

                    video_id = entry.get("id")
                    proxy_url = f"{base_url}/api/stream?vid={video_id}"

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
                        "audio_url": entry.get("url"),
                        "proxy_url": proxy_url 
                    })

            return jsonify(entries)

    except Exception as e:
        print(f"Trending Error: {e}")
        return jsonify([])

@app.route("/api/stream", methods=["GET"])
def api_stream():
    video_id = request.args.get("vid")
    if not video_id: 
        return jsonify({"error": "Missing video ID"}), 400

    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["android"]
            }
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            audio_url = info.get("url")

        if not audio_url: 
            return jsonify({"error": "Could not extract audio"}), 500

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36", 
            "Referer": "https://www.youtube.com/"
        }
        
        range_header = request.headers.get("Range")
        if range_header: 
            headers["Range"] = range_header

        upstream = requests.get(audio_url, headers=headers, stream=True)
        
        response = Response(
            stream_with_context(upstream.iter_content(chunk_size=8192)),
            status=upstream.status_code,
        )

        for h in ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]:
            if h in upstream.headers:
                response.headers[h] = upstream.headers[h]

        return response

    except Exception as e:
        print(f"Streaming error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("MEDIA_PORT", "5000"))
    )
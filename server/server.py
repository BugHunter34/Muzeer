from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp
import requests
from urllib.parse import quote
from flask.cli import load_dotenv

app = Flask(__name__)

# Allow your React app to talk to this service
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

YDL_OPTS = {
    "format": "bestaudio/best",
    "quiet": True,
    "noplaylist": True,
    "force_generic_extractor": False, 
    "extract_flat": "in_playlist", 
    "default_search": "https://music.youtube.com/search?q=",
}

load_dotenv()

def build_proxy_url(audio_url):
    if not audio_url:
        return ""
    base = request.host_url.rstrip("/")
    return f"{base}/api/stream?url={quote(audio_url, safe='')}"

@app.route("/api/search", methods=["POST"])
def api_search():
    data = request.get_json(silent=True) or {}
    query = data.get("query")
    if not query: return jsonify({"error": "Missing query"}), 400

    def to_track_payload(info, fallback_query):
        video_id = info.get("id")
        thumbnail = info.get("thumbnail") or (f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else "")
        
        return {
            "title": info.get("title", fallback_query),
            "artist": info.get("uploader", "Unknown Artist"),
            "webpage_url": info.get("url") or info.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}",
            "thumbnail": thumbnail,
            "audio_url": info.get("url", ""), 
            "proxy_url": f"{request.host_url.rstrip('/')}/api/stream?vid={video_id}",
            "duration": info.get("duration", 0)
        }

    search_opts = {
        "extract_flat": True, 
        "quiet": True,
    }

    try:
        with yt_dlp.YoutubeDL(search_opts) as ydl:
            normalized_query = str(query).strip()
            
            if normalized_query.startswith(("http://", "https://")):
                info = ydl.extract_info(normalized_query, download=False)
                if "entries" in info:
                    results = [to_track_payload(e, normalized_query) for e in info["entries"] if e]
                    return jsonify(results)
                return jsonify([to_track_payload(info, normalized_query)])

            search_info = ydl.extract_info(f"ytsearch10:{normalized_query} official audio", download=False)
            entries = (search_info or {}).get("entries") or []
            results = [to_track_payload(entry, normalized_query) for entry in entries if entry]
            
            return jsonify(results)
            
    except Exception as e:
        print(f"Search Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/stream", methods=["GET"])
def api_stream():
    video_id = request.args.get("vid")
    if not video_id: return jsonify({"error": "Missing video ID"}), 400

    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            audio_url = info.get("url")

        if not audio_url: return jsonify({"error": "Could not extract audio"}), 500

        headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.youtube.com/"}
        range_header = request.headers.get("Range")
        if range_header: headers["Range"] = range_header

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

@app.route("/api/trending", methods=["GET"])
def api_trending():
    try:
        chart_url = "https://www.youtube.com/playlist?list=OLAK5uy_m3ud6eoJmyRFm7jnkVVctmbi9h8pDGJ7U"
        ydl_opts = {
            'quiet': True, 
            'extract_flat': True,
            'playlistend': 8 
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(chart_url, download=False)
            entries = []
            if 'entries' in result:
                for entry in result['entries']: 
                    video_id = entry.get("id")
                    entries.append({
                        "title": entry.get("title"),
                        "artist": entry.get("uploader", "Unknown Artist"),
                        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                        "webpage_url": entry.get("url", f"https://www.youtube.com/watch?v={video_id}"),
                        "id": video_id
                    })
            return jsonify(entries)
            
    except Exception as e:
        print(f"Trending Error: {e}")
        return jsonify([])

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
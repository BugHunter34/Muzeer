from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp
import random
import requests
from pymongo import MongoClient
import bcrypt
from urllib.parse import quote

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

YDL_OPTS = {
    "format": "bestaudio/best",
    "quiet": True,
    "noplaylist": True,
    "default_search": "ytsearch",
}

client = MongoClient("mongodb+srv://admin:admin@hudba.lrwxpfn.mongodb.net/mydatabase?retryWrites=true&w=majority&appName=Hudba")
db = client["mydatabase"]
users = db["users"]

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

    try:
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            info = ydl.extract_info(query, download=False)
            if "entries" in info: info = info["entries"][0]

            return jsonify({
                "title": info.get("title", query),
                "artist": info.get("uploader", "Unknown Artist"),
                "webpage_url": info.get("webpage_url", ""),
                "thumbnail": info.get("thumbnail", ""),
                "audio_url": info.get("url", ""),
                "proxy_url": build_proxy_url(info.get("url", "")),
                "duration": info.get("duration", 0)
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/stream", methods=["GET"])
def api_stream():
    audio_url = request.args.get("url", "")
    if not audio_url:
        return jsonify({"error": "Missing url"}), 400

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.youtube.com/",
    }
    range_header = request.headers.get("Range")
    if range_header:
        headers["Range"] = range_header

    upstream = requests.get(audio_url, headers=headers, stream=True)
    response = Response(
        stream_with_context(upstream.iter_content(chunk_size=8192)),
        status=upstream.status_code,
    )

    passthrough_headers = [
        "Content-Type",
        "Content-Length",
        "Content-Range",
        "Accept-Ranges",
        "Cache-Control",
    ]
    for header in passthrough_headers:
        if header in upstream.headers:
            response.headers[header] = upstream.headers[header]

    return response

@app.route("/api/trending", methods=["GET"])
def api_trending():
    try:
        # Using the official YouTube Global Top Songs playlist URL.
        # You can swap this with a specific country's chart playlist URL if needed.
        chart_url = "https://www.youtube.com/playlist?list=OLAK5uy_m3ud6eoJmyRFm7jnkVVctmbi9h8pDGJ7U"
        
        ydl_opts = {
            'quiet': True, 
            'extract_flat': True, # Crucial: gets metadata instantly without downloading/processing audio
            'playlistend': 8      # Only fetch the top 1 result to make the API response lightning fast
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info from the playlist
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
    
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""
    user_name = (data.get("userName") or "").strip()
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    if users.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 400

    
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    users.insert_one({
        "email": email,
        "userName": user_name,
        "passwordHash": password_hash,
        "role": "user",
    })

    return jsonify({"ok": True}), 201

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
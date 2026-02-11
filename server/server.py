from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import os

app = Flask(__name__)

# Enable CORS for all routes, specifically allowing the Vite default port
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

YDL_OPTS = {
    "format": "bestaudio/best",
    "quiet": True,
    "default_search": "ytsearch",
    "noplaylist": True,
    # "cookiefile": "youtube_netscape.txt", # Uncomment if you have the file
}

@app.route("/api/search", methods=["POST"])
def api_search():
    data = request.get_json(silent=True) or {}
    query = data.get("query")

    if not query:
        return jsonify({"error": "Missing query"}), 400

    try:
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            info = ydl.extract_info(query, download=False)
            if "entries" in info:
                info = info["entries"][0]

        return jsonify({
            "title": info.get("title", query),
            "webpage_url": info.get("webpage_url", ""),
            "thumbnail": info.get("thumbnail", "")
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Run on port 3000
    app.run(host="0.0.0.0", port=3000, debug=True)
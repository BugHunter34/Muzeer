import os
import asyncio
import httpx
import yt_dlp
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load env variables
load_dotenv(dotenv_path=".env")

app = FastAPI()

# --- CORS SETUP ---
def parse_csv_env(value, fallback=""):
    source = value or fallback
    return [entry.strip() for entry in source.split(",") if entry.strip()]

allowed_origins = parse_csv_env(
    os.getenv("MEDIA_CORS_ALLOWED_ORIGINS"),
    "http://localhost:5173"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- YT-DLP CONFIG ---
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

# --- HELPER FUNCTIONS ---
def to_track_payload(info, fallback_query, base_url: str):
    video_id = info.get("id")
    thumbnail = info.get("thumbnail") or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    audio_url = info.get("url")
    
    # Ensure base_url formatting
    base_url = base_url.rstrip("/")
    proxy_url = f"{base_url}/api/stream?vid={video_id}"

    return {
        "id": video_id,
        "title": info.get("title", fallback_query),
        "artist": info.get("uploader", "Unknown Artist"),
        "thumbnail": thumbnail,
        "duration": info.get("duration", 0),
        "webpage_url": info.get("webpage_url", f"https://www.youtube.com/watch?v={video_id}"),
        "audio_url": audio_url,
        "proxy_url": proxy_url 
    }

# Blocking yt_dlp call needs to be isolated so it doesn't block the Async Event Loop
def extract_info_sync(query: str, download=False, custom_opts=None):
    opts = custom_opts if custom_opts else YDL_OPTS
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(query, download=download)


# --- REQUEST MODELS ---
class SearchRequest(BaseModel):
    query: str

class PlaylistRequest(BaseModel):
    url: str
    source: str = "youtube"

# --- ROUTES ---

@app.post("/api/playlist")
async def api_playlist(data: PlaylistRequest, request: Request):
    if not data.url:
        raise HTTPException(status_code=400, detail="Missing URL")
        
    base_url = str(request.base_url)
    

    playlist_opts = YDL_OPTS.copy()
    playlist_opts.update({
        "noplaylist": False,
        "playlistend": 2000, # 50 song cap
        "extract_flat": False,
        "ignoreerrors": True

    })

    try:
        # background
        info = await asyncio.to_thread(extract_info_sync, data.url, False, playlist_opts)
        
        # is single video instead of playlist -> wrap it up
        entries = info.get("entries") if "entries" in info else [info]
        
        playlist_name = info.get("title", "Imported Playlist")
        playlist_id = info.get("id", f"import-{os.urandom(4).hex()}")
        
        tracks = []
        for entry in entries:
            if not entry: continue
            tracks.append(to_track_payload(entry, entry.get("title", ""), base_url))
            
        return {
            "playlist": {
                "id": playlist_id,
                "name": playlist_name
            },
            "tracks": tracks
        }
        
    except Exception as e:
        print(f"Playlist Extraction Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/api/search")
async def api_search(data: SearchRequest, request: Request):
    if not data.query:
        raise HTTPException(status_code=400, detail="Missing query")

    normalized_query = str(data.query).strip()
    base_url = str(request.base_url)

    try:
        # Run the heavy yt_dlp process in a background thread
        if normalized_query.startswith(("http://", "https://")):
            info = await asyncio.to_thread(extract_info_sync, normalized_query, False)
            
            if "entries" in info:
                return [to_track_payload(e, normalized_query, base_url) for e in info["entries"] if e]
            return [to_track_payload(info, normalized_query, base_url)]

        search_url = f"ytsearch10:{normalized_query} official audio"
        search_info = await asyncio.to_thread(extract_info_sync, search_url, False)
        
        entries = (search_info or {}).get("entries") or []
        return [to_track_payload(entry, normalized_query, base_url) for entry in entries if entry]

    except Exception as e:
        print(f"Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/trending")
async def api_trending(request: Request):
    chart_url = "https://www.youtube.com/playlist?list=OLAK5uy_m3ud6eoJmyRFm7jnkVVctmbi9h8pDGJ7U"
    
    trending_opts = YDL_OPTS.copy()
    trending_opts.update({
        "playlistend": 8,
        "noplaylist": False # Override to allow playlist scraping
    })

    try:
        base_url = str(request.base_url)
        # Run in thread to not block server
        result = await asyncio.to_thread(extract_info_sync, chart_url, False, trending_opts)

        entries = []
        if "entries" in result:
            for entry in result["entries"]:
                if not entry: continue
                entries.append(to_track_payload(entry, entry.get("title", ""), base_url))

        return entries

    except Exception as e:
        print(f"Trending Error: {e}")
        return []


@app.get("/api/stream")
async def api_stream(vid: str, request: Request):
    if not vid:
        raise HTTPException(status_code=400, detail="Missing video ID")

    try:
        # Get raw URL in background thread
        info = await asyncio.to_thread(extract_info_sync, f"https://www.youtube.com/watch?v={vid}", False)
        audio_url = info.get("url")

        if not audio_url:
            raise HTTPException(status_code=500, detail="Could not extract audio")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36", 
            "Referer": "https://www.youtube.com/"
        }
        
        # Forward range header from the client exactly as Flask did
        range_header = request.headers.get("Range")
        if range_header:
            headers["Range"] = range_header

        # Asynchronous streaming using HTTPX
        client = httpx.AsyncClient()
        req = client.build_request("GET", audio_url, headers=headers)
        r = await client.send(req, stream=True)

        async def stream_generator():
            async for chunk in r.aiter_bytes(chunk_size=8192):
                yield chunk
            # Clean up the connection when finished
            await r.aclose()
            await client.aclose()

        # Build response headers
        response_headers = {}
        for h in ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]:
            if h in r.headers:
                response_headers[h] = r.headers[h]

        return StreamingResponse(
            stream_generator(),
            status_code=r.status_code,
            headers=response_headers
        )

    except Exception as e:
        print(f"Streaming error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Note: In production, it's better to run this via Uvicorn command line rather than app.run()
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("MEDIA_PORT", "5000"))
    # We pass "server:app" as a string so uvicorn can run multiple workers if needed
    uvicorn.run("server:app", host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*")
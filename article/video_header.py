"""Validated sources for the redesigned full-bleed article video header."""

from pathlib import PurePosixPath
from urllib.parse import parse_qs, urlparse


VIDEO_FILE_EXTENSIONS = {".mp4", ".webm"}


def supported_video_file(document):
    """Only expose file types browsers can reasonably play inline."""
    return PurePosixPath(document.file.name.lower()).suffix in VIDEO_FILE_EXTENSIONS


def youtube_video_id(url):
    """Accept normal, short, live, and embed YouTube links, but no other host."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"}:
        return None
    if host in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"}:
        parts = parsed.path.strip("/").split("/")
        if parts[0] == "watch":
            candidate = parse_qs(parsed.query).get("v", [""])[0]
        elif len(parts) == 2 and parts[0] in {"embed", "live", "shorts"}:
            candidate = parts[1]
        else:
            return None
    elif host in {"youtu.be", "www.youtu.be"}:
        candidate = parsed.path.strip("/")
    else:
        return None
    if len(candidate) == 11 and all(character.isalnum() or character in "-_" for character in candidate):
        return candidate
    return None


def youtube_embed_url(url, *, preview=False):
    video_id = youtube_video_id(url)
    if not video_id:
        return ""
    parameters = "autoplay=1&playsinline=1&rel=0"
    if preview:
        parameters += f"&mute=1&loop=1&playlist={video_id}&controls=0&disablekb=1"
    return f"https://www.youtube-nocookie.com/embed/{video_id}?{parameters}"

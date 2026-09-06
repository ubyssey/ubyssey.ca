from urllib.parse import urlparse

from django import template


register = template.Library()


@register.simple_tag(takes_context=True)
def auxiliary_url(context, value):
    """Return a Wagtail page URL or a fixture URL used by local redesign previews."""
    preview_url = getattr(value, "preview_url", "")
    if preview_url:
        return preview_url
    get_url = getattr(value, "get_url", None)
    if get_url:
        return get_url(request=context.get("request"))
    return getattr(value, "url", "#")


@register.simple_tag(takes_context=True)
def auxiliary_section(context, value):
    """Return the stored section, falling back to the first URL segment."""
    section = getattr(value, "current_section", "")
    if section:
        return str(section).replace("-", " ").title()
    preview_url = getattr(value, "preview_url", "")
    get_url = getattr(value, "get_url", None)
    if not preview_url and get_url:
        preview_url = get_url(request=context.get("request")) or ""
    path = urlparse(preview_url).path
    parts = [part for part in path.split("/") if part]
    return parts[0].replace("-", " ").title() if parts else "Story"


@register.filter
def spotify_embed_url(value):
    """Convert a public Spotify episode URL to its iframe URL."""
    fallback = "https://open.spotify.com/episode/3JcrkvjI0i1WvC4ztaIBol"
    raw = (value or fallback).strip()
    parsed = urlparse(raw)
    parts = [part for part in parsed.path.split("/") if part]
    if parsed.netloc not in {"open.spotify.com", "www.open.spotify.com"}:
        raw = fallback
        parts = ["episode", "3JcrkvjI0i1WvC4ztaIBol"]
    if parts and parts[0] == "embed":
        return raw
    if len(parts) >= 2 and parts[0] in {"episode", "show"}:
        return f"https://open.spotify.com/embed/{parts[0]}/{parts[1]}?utm_source=generator"
    return "https://open.spotify.com/embed/episode/3JcrkvjI0i1WvC4ztaIBol?utm_source=generator"

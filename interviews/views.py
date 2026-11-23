from django.contrib.auth.decorators import login_required
from django.shortcuts import render

# Placeholder rows until the Recording model exists.
# Mirrors the "Library (desktop)" wireframe.
MOCK_RECORDINGS = [
    {
        "title": "AMS budget interview",
        "snippet": "Can you walk me through how this year’s budget was put together?",
        "section": "News",
        "uploader": "Reporter A",
        "date": "Nov 3",
        "length": "42:18",
        "status": "ready",
        "status_label": "Ready",
        "restricted": False,
    },
    {
        "title": "Board of Governors meeting",
        "snippet": "Transcript will appear here when processing finishes.",
        "section": "News",
        "uploader": "Editor B",
        "date": "Nov 2",
        "length": "1:58:04",
        "status": "processing",
        "status_label": "Transcribing 40%",
        "restricted": False,
    },
    {
        "title": "Confidential source call",
        "snippet": "Visible to masthead and people they shared it with.",
        "section": "Features",
        "uploader": "Reporter C",
        "date": "Nov 1",
        "length": "23:40",
        "status": "ready",
        "status_label": "Ready",
        "restricted": True,
    },
    {
        "title": "Varsity coach post-game",
        "snippet": "Transcription failed. Masthead can retry without re-uploading.",
        "section": "Sports",
        "uploader": "Reporter D",
        "date": "Oct 30",
        "length": "11:05",
        "status": "failed",
        "status_label": "Failed",
        "restricted": False,
    },
    {
        "title": "Gallery opening remarks",
        "snippet": "Thanks everyone for coming out tonight, this show has been two years in the making.",
        "section": "Culture",
        "uploader": "Reporter E",
        "date": "Oct 28",
        "length": "17:52",
        "status": "ready",
        "status_label": "Ready",
        "restricted": False,
    },
    {
        "title": "New Recording 14",
        "snippet": "Upload in progress…",
        "section": "—",
        "uploader": "Reporter A",
        "date": "Oct 27",
        "length": "—",
        "status": "uploading",
        "status_label": "Uploading",
        "restricted": False,
    },
]

SECTIONS = ["News", "Features", "Culture", "Sports", "Science", "Opinion"]
RECORDING_TYPES = ["Interview", "Meeting", "Event"]


@login_required
def library(request):
    return render(request, "interviews/library.html", {
        "recordings": MOCK_RECORDINGS,
        "sections": SECTIONS,
        "recording_types": RECORDING_TYPES,
    })

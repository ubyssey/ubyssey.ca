from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from webpush import send_user_notification

@login_required
def mockWebPush(request):
    payload = {
        "head": "Testing Webpush",
        "body": f"Okedoke artichoke",
    }
    send_user_notification(
        user=request.user,
        payload=payload,
        ttl=1000,
    )
    return JsonResponse({"success": True})



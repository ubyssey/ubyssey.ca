import requests

def get_light_mode(request):
    mode = request.COOKIES.get('lightMode')
    if mode == "dark":
        return {"mode": "darkmode"}
    else: 
        return {"mode": "lightmode"}
def get_light_mode(request):
    mode = request.COOKIES.get('lightMode')
    if mode == "dark":
        return {"mode": "dark"}
    else: 
        return {"mode": "light"}
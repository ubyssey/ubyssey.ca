from django.http import JsonResponse

class JsonErrorMiddleware:
    def __init__(self, get_response):
        print("--- MIDDLEWARE LOADED")
        self.get_response = get_response
    
    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, excep):
        print("---ERROR HANDLED")
        return JsonResponse({"error": str(excep)}, status=500)
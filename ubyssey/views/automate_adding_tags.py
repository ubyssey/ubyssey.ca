from django.conf import settings
from django.shortcuts import render
import openai
from images.models import UbysseyImage

# openai.api_key = settings.OPENAI_API_KEY

def get_image_urls(request):
    images = UbysseyImage.objects.all()  # Fetch all UbysseyImage instances
    base_url = settings.MEDIA_URL  # Access the MEDIA_URL setting
    image_urls = []

    for image in images:
        url = request.build_absolute_uri(base_url + image.file.name)
        image_urls.append(url)
    get_image_tags(image_urls)
        
    # Pass image_urls to OpenAI API or render them in a template if needed
    return render(request, 'centennial.html', {})

def get_image_tags(image_urls):
    # Construct messages for OpenAI API
    messages = [
        {
        "role": "user",
        "content": {
            "type": "text",
                "text": "Please provide the following tags for each image: \n\n"
                        "Subject (e.g., 'building exterior', 'building interior')\n"
                        "Subject Name (e.g., 'ams nest')\n"
                        "Medium (e.g., 'photograph', 'illustration', 'digital illustration', 'collage')"
            }
        }
    ]

    for url in image_urls:
        messages.append({
            "role": "user",
            "content": {
                "type": "image_url",
                "image_url": {
                    "url": url,
                }
            }
        })

    # Call the OpenAI API
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=messages,
        max_tokens=300,
    )
    
   

from django.conf import settings
from django.shortcuts import render
from openai import OpenAI
from images.models import UbysseyImage
import os
from dotenv import load_dotenv, find_dotenv

# openai.api_key = settings.OPENAI_API_KEY
def get_image_urls(request):
    images = UbysseyImage.objects.all()  # Fetch all UbysseyImage instances
    base_url = settings.MEDIA_URL  # Access the MEDIA_URL setting
    image_urls = []

    for image in images:
        url = request.build_absolute_uri(base_url + image.file.name)
        image_urls.append(url)
        # print(url)
    get_image_tags(image_urls)
        
    # Pass image_urls to OpenAI API or render them in a template if needed
    return render(request, 'centennial.html', {})

def get_image_tags(image_urls):
    _ = load_dotenv(find_dotenv())
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'),)
    # # Construct messages for OpenAI API
    # messages = [
    #     {
    #     "role": "user",
    #     "content": {
    #         "type": "text",
    #             "text": "Please provide the following tags for each image: \n\n"
    #                     "Subject (e.g., 'building exterior', 'building interior')\n"
    #                     "Subject Name (e.g., 'ams nest')\n"
    #                     "Medium (e.g., 'photograph', 'illustration', 'digital illustration', 'collage')"
    #         }
    #     }
    # ]

    # for url in image_urls:
    #     messages.append({
    #         "role": "user",
    #         "content": {
    #             "type": "image_url",
    #             "image_url": {
    #                 "url": url,
    #             }
    #         }
    #     })

    # # Call the OpenAI API
    # response = openai.ChatCompletion.create(
    #     model="gpt-4",
    #     messages=messages,
    #     max_tokens=300,
    # )
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": "Can you write tags and description only with no timepass information. In tags describe what happens in the picture and the medium of photography, in the description describe the image that helps in indexing the picture to search faster. I want it to be like \"snowfield\", \"playing\", \"People are playing in the snow\". Where there should be space between each field and there should be double quotes for tags and description and, between tags and description to differentiate between them. Please no irrelevant information other than the actual tags and description"
            },
            {
                "role": "user",
                "content": "https://ubyssey.storage.googleapis.com/media/wagtail_images/2024/04/240429_i_janmohamed_encampment.JPG"
            }
        ],
        temperature=1,
        max_tokens=256,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )
    # prompt = (
    #     "Can you write tags and description only with no timepass information. "
    #     "In tags describe what happens in the picture and the medium of photography, "
    #     "in the description describe the image that helps in indexing the picture to search faster. "
    #     "I want it to be like \"snowfield\" \"playing\",\"People are playing in the snow\". "
    #     "Where there should be space between each field and there should be double quotes for tags and description and , "
    #     "between tags and description to differentiate between them. Please no irrelevant information other than the actuals tags and description"
    # )
    # client = OpenAI()
    # response = client.ChatCompletion.create(
    #     model="gpt-4",
    #     messages=[
    #         {
    #             "role": "user",
    #             "content": f"[{prompt} Image URL: {image_urls[0]}]"
    #         }
    #     ],
    #     temperature=1,
    #     max_tokens=100,
    #     top_p=1,
    #     frequency_penalty=0,
    #     presence_penalty=0
    # )
    choices = response.choices
    chat_completion = choices[0]
    content = chat_completion.message.content # Correct (this works with the Chat Completions API)
    print(content)

def populate_tags(tags, descriptions):
    images = UbysseyImage.objects.all()
    for image, (tag, description) in zip(images, zip(tags, descriptions)):
        image.tags.add(tag)
        image.description = description
        image.save()   

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
    get_image_tags([image_urls[0],image_urls[5555]])
        
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
    messages = [
        {
            "role": "user",
            "content": "Can you write tags and description only with no timepass information. All the pictures are mostly set in UBC where the description is for UBC students. It is all from this open source website https://ubyssey.ca/ In tags describe what happens in the picture and the medium of photography, in the description describe the image that helps in indexing the picture to search faster. For example it can be like \"tag1\", \"tag2\", \"description\". Where there should be space between each field and there should be double quotes for tags and description and, between tags and description to differentiate between them. Please no irrelevant information other than the actual tags and description"
        },
    ]
    for url in image_urls:
        messages.append({
            "role": "user",
            "content": url
        },)

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=1,
        max_tokens=200,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )
    choices = response.choices
    chat_completion = choices[0]
    content = chat_completion.message.content # Correct (this works with the Chat Completions API)
    print(content+"                  ")

    # # Assuming image_urls is a list of URLs to process similarly
    # for url in image_urls:
    #     messages.append({
    #         "role": "user",
    #         "content": url
    #     })

    # response = client.chat.completions.create(
    #     model="gpt-4o",
    #     messages=messages,
    #     temperature=1,
    #     max_tokens=200,
    #     top_p=1,
    #     frequency_penalty=0,
    #     presence_penalty=0
    # )
    # print(response.choices[1].message.content)

def populate_tags(tags, descriptions):
    images = UbysseyImage.objects.all()
    for image, (tag, description) in zip(images, zip(tags, descriptions)):
        image.tags.add(tag)
        image.description = description
        image.save()   

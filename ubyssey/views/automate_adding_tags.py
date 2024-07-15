import re
from django.conf import settings
from django.shortcuts import render
from openai import OpenAI
from images.models import UbysseyImage
import os
from dotenv import load_dotenv, find_dotenv

def split_tags_and_description(content):

    # Corrected regular expression pattern to match tags and description with comma separator
    pattern = r'((?:"[^"]+"\s*)+),\s*(.+)'

    # Using re.findall to extract all matches
    matches = re.findall(pattern, content)

    # Initialize lists to store tags and descriptions
    tags_list = []
    description_list = []

    # Iterate over matches
    for tags, description in matches:
        # Split tags by quotes and spaces, and remove empty strings from the result
        tag_list = [tag.strip('" ') for tag in tags.split('" "') if tag.strip()]
        tags_list.append(tag_list)
        description_list.append(description.strip())  # Description without leading/trailing spaces

    # Print each element of matches
    for tags, description in zip(tags_list, description_list):
        print("Tags:", tags)
        print("Description:", description)
        print()  
    

# openai.api_key = settings.OPENAI_API_KEY
def get_image_urls(request):
    images = UbysseyImage.objects.all()  # Fetch all UbysseyImage instances
    base_url = settings.MEDIA_URL  # Access the MEDIA_URL setting
    image_urls = []

    for image in images:
        url = request.build_absolute_uri(base_url + image.file.name)
        image_urls.append(url)
    get_image_tags([image_urls[0],image_urls[333]])
        
    # Pass image_urls to OpenAI API or render them in a template if needed
    return render(request, 'centennial.html', {})

def get_image_tags(image_urls):
    _ = load_dotenv(find_dotenv())
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'),)

    messages = [
        {
            "role": "user",
            "content": "Can you write tags and description only with no timepass information. All the pictures are mostly set in UBC where the description is for UBC students. It is all from this open source website https://ubyssey.ca/ In tags describe what happens in the picture and the medium of photography, in the description describe the image that helps in indexing the picture to search faster. For example it can be like \"tag1\" \n\"tag2\",\"description\". Where there should be space between each field of tags and there should be a comma between tags and description to differentiate between them. Please no irrelevant information other than the actual tags and description. I want the description to also be in double quotes"
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

    # Assuming image_urls is a list of URLs to process similarly
    for url in image_urls:
        messages.append({
            "role": "user",
            "content": url
        })

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=1,
        max_tokens=200,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )
    print(response.choices[0].message.content)
    split_tags_and_description(response.choices[0].message.content)


def populate_tags(tags, descriptions):
    images = UbysseyImage.objects.all()
    for image, (tag, description) in zip(images, zip(tags, descriptions)):
        image.tags.add(tag)
        image.description = description
        image.save()   

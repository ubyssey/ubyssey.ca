import re
from django.conf import settings
from django.shortcuts import render
from openai import OpenAI
from images.models import UbysseyImage
import os
from dotenv import load_dotenv, find_dotenv
    
def split_tags_and_description(input_string):
    # Define the regex pattern to match tags and descriptions
    # The pattern will capture multiple tags separated by ', ', and a description following them.
    pattern = re.compile(r'(".*?")\s*(?:",\s*")*"(.*?)"')

    # Find all matches in the input string
    matches = pattern.findall(input_string)

    tags = []
    descriptions = []

    for match in matches:
        # Process tags
        tags_part = match[0]
        # Split tags based on '", "'
        tag_list = tags_part.split('", "')
        # Clean up each tag by removing surrounding quotes and any extra spaces
        tag_list = [tag.strip('"') for tag in tag_list]
        tags.append(tag_list)

        # Process description
        description = '"' + match[1] + '"'
        descriptions.append(description)
    for tags, description in zip(tags, descriptions):
        print("Tags:", tags)
        print("Description:", description)
        print()  

    return tags, descriptions

# openai.api_key = settings.OPENAI_API_KEY
def get_image_urls(request):
    images = UbysseyImage.objects.all()  # Fetch all UbysseyImage instances
    base_url = settings.MEDIA_URL  # Access the MEDIA_URL setting
    image_urls = []

    for image in images:
        url = request.build_absolute_uri(base_url + image.file.name)
        image_urls.append(url)
    print(image_urls[9999])
    print(image_urls[333])
    get_image_tags([image_urls[9999],image_urls[333]])
        
    # Pass image_urls to OpenAI API or render them in a template if needed
    return render(request, 'centennial.html', {})

def get_image_tags(image_urls):
    _ = load_dotenv(find_dotenv())
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'),)
    prompt = (
        "Can you provide tags and a description for each image with no additional information? All images are from UBC and are intended for UBC students. The source is this open website: https://ubyssey.ca/\n\n"
        "For each image:\n"
        "1. **Tags:** Describe what happens in the image and the medium of photography. Each tag should be enclosed in double quotes.\n"
        "2. **Description:** Describe the image to assist in indexing for faster search. The description should also be enclosed in double quotes.\n\n"
        "**Format Example for Each Image:**\n"
        "- **Tags:** \"tag1\", \"tag2\", \"tag3\"\n"
        "- **Description:** \"This is a detailed description of the image.\"\n\n"
        "**Separation Between Images:**\n"
        "- Separate the output for each image with a double newline (\\n\\n).\n\n"
        "**Example:**\n"
        "\n"
        "\"tag1\", \"tag2\", \"tag3\", \"tag4\", \"tag5\"\n"
        "\"This is the description for the first image.\"\n\n"
        "\"tagA\", \"tagB\", \"tagC\"\n"
        "\"This is the description for the second image.\"\n\n"
        "**Note:** Ensure that each set of tags and descriptions is clearly separated by a double newline. Each set should be formatted as shown above with tags in double quotes and the description also in double quotes. This format will make it easier to use the `split_tags_and_description` function to separate the tags and descriptions where tags is a list of lists of strings."
    )

    messages = [
        {
            "role": "user",
            "content": prompt
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
    # print(content+"                  ")

    print(response.choices[0].message.content)
    tags, descriptions = split_tags_and_description(response.choices[0].message.content)
    # populate_tags(tags, descriptions)


def populate_tags(tags, descriptions):
    images = UbysseyImage.objects.all()
    for image, (tag, description) in zip(images, zip(tags, descriptions)):
        image.tags.add(tag)
        image.description = description
        image.save()   

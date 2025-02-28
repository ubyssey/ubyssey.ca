import re
from django.conf import settings
from django.shortcuts import render
from openai import OpenAI
from images.models import UbysseyImage
import os
from dotenv import load_dotenv, find_dotenv
    
def split_tags_and_description(input_string):
    images_data = input_string.strip().split("\n\n")
    tags_list = []
    descriptions_list = []

    for image_data in images_data:
        lines = image_data.strip().split("\n")
        if len(lines) == 2:
            tags = lines[0].split(", ")
            description = lines[1]
            tags_list.append(tags)
            descriptions_list.append(description)
    
    # for tagss, description in zip(tags_list, descriptions_list):
    #     print("Tags:", tagss)
    #     print("Description:", description)
    #     print()  
    # print(tags_list+"      "+descriptions_list)
    return tags_list, descriptions_list

# openai.api_key = settings.OPENAI_API_KEY
def get_image_urls(request):
    images = UbysseyImage.objects.all()  # Fetch all UbysseyImage instances
    base_url = settings.MEDIA_URL  # Access the MEDIA_URL setting
    image_urls = []

    for image in images:
        url = request.build_absolute_uri(base_url + image.file.name)
        image_urls.append(url)
    # print(image_urls)
    # print(image_urls[333])
    get_image_tags(['http://ubyssey.storage.googleapis.com/media/wagtail_images/2015/10/DA-TOOPSTER_20140228__MACKENZIE-WALKER.jpg', 
                    'http://ubyssey.storage.googleapis.com/media/wagtail_images/2015/10/Choice-Chain-Will-McDonald.jpg', 
                    'http://ubyssey.storage.googleapis.com/media/wagtail_images/2015/10/Screen-Shot-2014-04-06-at-5.52.15-PM-200x166.png', 
                    'http://ubyssey.storage.googleapis.com/media/wagtail_images/2015/10/Screen-shot-2014-04-14-at-10.10.57-PM-325x295.png', 
                    'http://ubyssey.storage.googleapis.com/media/wagtail_images/2015/10/Emily-Chang_20140317__Rehyana-Heatherington.jpg'])
    # Pass image_urls to OpenAI API or render them in a template if needed
    return render(request, 'centennial.html', {})

def get_image_tags(image_urls):
    # print(image_urls)
    _ = load_dotenv(find_dotenv())
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'),)
    prompt = (
        "Can you provide tags and a description for each image with no additional information? All images are from UBC and are intended for UBC students.\n\n"
        "Also take hints from the urls regarding who might be in picture or what the picture might be about.\n"
        "For each image:\n"
        "1. Tags: Describe what happens in the image and the medium of photography. Each tag should be concise. Provide 4 to 5 tags for each image. Also remember all images are taken UBC.\n"
        "2. Description: Describe the image to assist in indexing for faster search.\n\n"
        "Format Example for Each Image:\n"
        "tag1, tag2, tag3, tag4, tag5\n"
        "This is a detailed description of the image.\n\n"
        "Separation Between Images:\n"
        "- Separate the output for each image with a double newline (\\n\\n).\n\n"
        "Example:\n\n"
        "tag1, tag2, tag3, tag4, tag5\n"
        "This is the description for the first image.\n\n"
        "tagA, tagB, tagC, tagD, tagE\n"
        "This is the description for the second image.\n\n"
        "Note: Ensure that each set of tags and descriptions is clearly separated by a double newline. Each set should be formatted as shown above with tags separated by commas and the description in plain text. This format will make it easier to use the `split_tags_and_description` function to separate the tags and descriptions where tags is a list of lists of strings."
    )

    # Build the messages payload using the new structure
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }
    ]
    # Iterate through all image URLs and append each one as an image_url object
    for url in image_urls:
        print(url)
        messages[0]["content"].append({
            "type": "image_url",
            "image_url": {
                "url": url
            }
        })

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=1,
        # max_tokens=2048,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )
    choices = response.choices
    chat_completion = choices[0]
    content = chat_completion.message.content 

    # print(response.choices[0].message.content)
    tags, descriptions = split_tags_and_description(response.choices[0].message.content)
    print("Length is"+str(len(tags))+" descriptions: "+str(len(descriptions)))
    populate_tags(tags, descriptions)

def populate_tags(tags, descriptions):
    images = UbysseyImage.objects.all()[:len(tags)] 
    # print(f"Processing {len(images)} images with {len(tags)} tag sets")
    
    for image, tag_list, description in zip(images, tags, descriptions):
        # print(f"Adding tags to image: {image.id}")
                
        for tag in tag_list:
            image.tags.add(tag)
            
        tagged_ai = "Tagged by OpenAI Vision"
        image.tags.add(tagged_ai)
        
        image.description = "DESCRIPTION PROVIDED BY OPENAI VISION: " + description
        
        image.save()
        print(f"Successfully updated image {image.id} with {len(tag_list)} tags")
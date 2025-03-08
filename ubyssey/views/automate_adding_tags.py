import re
from django.conf import settings
from django.shortcuts import render
from openai import OpenAI
from images.models import UbysseyImage
import os
from dotenv import load_dotenv, find_dotenv
import csv
from datetime import datetime

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
    images = UbysseyImage.objects.exclude(tags__name='Tagged by OpenAI Vision')  # Fetch all UbysseyImage instances
    base_url = settings.MEDIA_URL  # Access the MEDIA_URL setting
    image_urls = []
    for image in images:
        url = request.build_absolute_uri(base_url + image.file.name)
        image_urls.append(url)
    # Write URLs to a text file
    output_file = 'latest_image_urls.txt'
    with open(output_file, 'w') as f:
        for url in image_urls:
            f.write(f"{url}\n")

    # print(image_urls)
    # print(image_urls[333])
    get_image_tags(image_urls)
    # Pass image_urls to OpenAI API or render them in a template if needed
    return render(request, 'centennial.html', {})

def get_image_tags(image_urls):
    # print(image_urls)
    _ = load_dotenv(find_dotenv())
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'),)
    prompt = (
        "Can you provide tags and a description for each image with no additional information? All images are from UBC and are intended for UBC students.\n\n"
        "Also take hints from the urls regarding who might be in picture or what the picture might be about.\n"
        "Also add synonyms for the tags.\n"
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

    # # Build the messages payload using the new structure
    # messages = [
    #     {
    #         "role": "user",
    #         "content": [
    #             {
    #                 "type": "text",
    #                 "text": prompt
    #             }
    #         ]
    #     }
    # ]
    # # Iterate through all image URLs and append each one as an image_url object
    # for url in image_urls:
    #     print(url)
    #     messages[0]["content"].append({
    #         "type": "image_url",
    #         "image_url": {
    #             "url": url
    #         }
    #     })

    # response = client.chat.completions.create(
    #     model="gpt-4o",
    #     messages=messages,
    #     temperature=1,
    #     # max_tokens=2048,
    #     top_p=1,
    #     frequency_penalty=0,
    #     presence_penalty=0
    # )
    # choices = response.choices
    # chat_completion = choices[0]
    # content = chat_completion.message.content 

    # # print(response.choices[0].message.content)
    # tags, descriptions = split_tags_and_description(response.choices[0].message.content)
    # print("Length is"+str(len(tags))+" descriptions: "+str(len(descriptions)))
    
    # # Write results to CSV file
    # timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    # output_file = f'image_tags_{timestamp}.csv'
    
    # with open(output_file, 'w', newline='', encoding='utf-8') as f:
    #     writer = csv.writer(f)
    #     # Write header
    #     writer.writerow(['Image URL', 'Tags', 'Description'])
        
    #     # Write data for each image
    #     for url, tag_list, description in zip(image_urls, tags, descriptions):
    #         writer.writerow([
    #             url,
    #             '; '.join(tag_list),  # Convert tag list to semicolon-separated string
    #             description
    #         ])
    
    # print(f"Wrote results to {output_file}")
    # # populate_tags(tags, descriptions)

    # Process images in smaller batches
    batch_size = 50
    all_tags = []
    all_descriptions = []
    
    for i in range(0, len(image_urls), batch_size):
        batch_urls = image_urls[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1} of {(len(image_urls) + batch_size - 1)//batch_size}")
        
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
        
        # Add batch of image URLs to messages
        for url in batch_urls:
            print(f"Processing: {url}")
            messages[0]["content"].append({
                "type": "image_url",
                "image_url": {"url": url}
            })

        try:
            response = client.chat.completions.create(
                model="gpt-4o",  # Updated model name
                messages=messages,
                temperature=1,
                max_tokens=1000,
                top_p=1,
                frequency_penalty=0,
                presence_penalty=0
            )
            
            batch_tags, batch_descriptions = split_tags_and_description(response.choices[0].message.content)
            all_tags.extend(batch_tags)
            all_descriptions.extend(batch_descriptions)
            
        except Exception as e:
            print(f"Error processing batch: {e}")
            continue
    
    # Write results to CSV
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f'image_tags_{timestamp}.csv'
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Image URL', 'Tags', 'Description'])
        
        for url, tag_list, description in zip(image_urls[:len(all_tags)], all_tags, all_descriptions):
            writer.writerow([
                url,
                '; '.join(tag_list),
                description
            ])
    
    print(f"Wrote results to {output_file}")
    return all_tags, all_descriptions
def populate_tags(tags, descriptions):
    images = UbysseyImage.objects.all()[:len(tags)] 
    # print(f"Processing {len(images)} images with {len(tags)} tag sets")
    
    for image, tag_list, description in zip(images, tags, descriptions):
        print(f"Adding tags to image: {image.id}")
                
        for tag in tag_list:
            image.tags.add(tag)
            
        tagged_ai = "Tagged by OpenAI Vision"
        image.tags.add(tagged_ai)
        
        image.description = "DESCRIPTION PROVIDED BY OPENAI VISION: " + description
        
        image.save()
        print(f"Successfully updated image {image.id} with {len(tag_list)} tags")
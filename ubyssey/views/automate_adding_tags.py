import re
from django.conf import settings
from django.shortcuts import render
from openai import OpenAI
from images.models import UbysseyImage
import os
from dotenv import load_dotenv, find_dotenv
import csv
from datetime import datetime
from article.models import ArticleFeaturedMediaOrderable
from django.db.models import Q
from wagtail.models.reference_index import ReferenceIndex, ReferenceGroups

# def split_tags_and_description(input_string):
#     images_data = input_string.strip().split("\n\n")
#     tags_list = []
#     descriptions_list = []

#     for image_data in images_data:
#         lines = image_data.strip().split("\n")
#         if len(lines) == 2:
#             tags = lines[0].split(", ")
#             description = lines[1]
#             tags_list.append(tags)
#             descriptions_list.append(description)
    
#     for tagss, description in zip(tags_list, descriptions_list):
#         print("Tags:", tagss)
#         print("Description:", description)
#         print()  
#     # print(tags_list+"      "+descriptions_list)
#     return tags_list, descriptions_list

# openai.api_key = settings.OPENAI_API_KEY
# def get_image_urls(request):
#     images = UbysseyImage.objects.exclude(tags__name='Tagged by OpenAI Vision')  # Fetch all UbysseyImage instances
#     base_url = settings.MEDIA_URL  # Access the MEDIA_URL setting
#     image_urls = []
#     for image in images:
#         url = request.build_absolute_uri(base_url + image.file.name)
#         image_urls.append(url)
#     # Write URLs to a text file
#     output_file = 'latest_image_urls.txt'
#     with open(output_file, 'w') as f:
#         for url in image_urls:
#             f.write(f"{url}\n")

#     # print(image_urls)
#     # print(image_urls[333])
#     get_image_tags(image_urls)
#     # Pass image_urls to OpenAI API or render them in a template if needed
#     return render(request, 'centennial.html', {})

# def get_image_tags(image_urls):
#     # print(image_urls)
#     _ = load_dotenv(find_dotenv())
#     client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'),)
#     prompt = (
#         "Can you provide tags and a description for each image with no additional information? All images are from UBC and are intended for UBC students.\n\n"
#         "Also take hints from the urls regarding who might be in picture or what the picture might be about.\n"
#         "Also add synonyms for the tags.\n"
#         "For each image:\n"
#         "1. Tags: Describe what happens in the image and the medium of photography. Each tag should be concise. Provide 4 to 5 tags for each image. Also remember all images are taken UBC.\n"
#         "2. Description: Describe the image to assist in indexing for faster search.\n\n"
#         "Format Example for Each Image:\n"
#         "tag1, tag2, tag3, tag4, tag5\n"
#         "This is a detailed description of the image.\n\n"
#         "Separation Between Images:\n"
#         "- Separate the output for each image with a double newline (\\n\\n).\n\n"
#         "Example:\n\n"
#         "tag1, tag2, tag3, tag4, tag5\n"
#         "This is the description for the first image.\n\n"
#         "tagA, tagB, tagC, tagD, tagE\n"
#         "This is the description for the second image.\n\n"
#         "Note: Ensure that each set of tags and descriptions is clearly separated by a double newline. Each set should be formatted as shown above with tags separated by commas and the description in plain text. This format will make it easier to use the `split_tags_and_description` function to separate the tags and descriptions where tags is a list of lists of strings."
#     )

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
    # batch_size = 50
    # all_tags = []
    # all_descriptions = []
    
    # for i in range(0, len(image_urls), batch_size):
    #     batch_urls = image_urls[i:i + batch_size]
    #     print(f"Processing batch {i//batch_size + 1} of {(len(image_urls) + batch_size - 1)//batch_size}")
        
    #     messages = [
    #         {
    #             "role": "user",
    #             "content": [
    #                 {
    #                     "type": "text",
    #                     "text": prompt
    #                 }
    #             ]
    #         }
    #     ]
        
    #     # Add batch of image URLs to messages
    #     for url in batch_urls:
    #         print(f"Processing: {url}")
    #         messages[0]["content"].append({
    #             "type": "image_url",
    #             "image_url": {"url": url}
    #         })

    #     try:
    #         response = client.chat.completions.create(
    #             model="gpt-4o",  # Updated model name
    #             messages=messages,
    #             temperature=1,
    #             max_tokens=1000,
    #             top_p=1,
    #             frequency_penalty=0,
    #             presence_penalty=0
    #         )
            
    #         batch_tags, batch_descriptions = split_tags_and_description(response.choices[0].message.content)
    #         all_tags.extend(batch_tags)
    #         all_descriptions.extend(batch_descriptions)
            
    #     except Exception as e:
    #         print(f"Error processing batch: {e}")
    #         continue
    
    # # Write results to CSV
    # timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    # output_file = f'image_tags_{timestamp}.csv'
    
    # with open(output_file, 'w', newline='', encoding='utf-8') as f:
    #     writer = csv.writer(f)
    #     writer.writerow(['Image URL', 'Tags', 'Description'])
        
    #     for url, tag_list, description in zip(image_urls[:len(all_tags)], all_tags, all_descriptions):
    #         writer.writerow([
    #             url,
    #             '; '.join(tag_list),
    #             description
    #         ])
    
    # print(f"Wrote results to {output_file}")
    # return all_tags, all_descriptions
def split_tags_and_description(input_string):
    # Remove any leading/trailing whitespace
    cleaned_input = input_string.strip()
    
    # Split by the first newline to separate tags from description
    parts = cleaned_input.split('\n', 1)
    tags_list = []
    descriptions_list = []
    
    if len(parts) >= 2:  # We have both tags and description
        tags = [tag.strip() for tag in parts[0].split(',')]
        description = parts[1].strip()
        tags_list.append(tags)
        descriptions_list.append(description)
    elif len(parts) == 1 and parts[0]:  # Only tags, no description
        tags = [tag.strip() for tag in parts[0].split(',')]
        tags_list.append(tags)
        descriptions_list.append("")
        
    # Print parsed results for debugging
    for tags, description in zip(tags_list, descriptions_list):
        print("Tags:", tags)
        print("Description:", description)
        print()
        
    return tags_list, descriptions_list

def get_image_urls(request):
    # # List of valid image extensions
    # valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp', '.svg']
    
    # # Create a Q object for each extension
    # extension_filter = Q()
    # for ext in valid_extensions:
    #     extension_filter |= Q(file__endswith=ext)
        
    # images = UbysseyImage.objects.exclude(tags__name='Tagged by OpenAI Vision').filter(extension_filter).order_by("-created_at")[:100]
    # base_url = settings.MEDIA_URL
    # image_data = []
    object_data = []
    # for image in images:
    #     url = request.build_absolute_uri(base_url + image.file.name)
    #     # print(url)
        
    #     article_titles = []
        
    #     # # Method 1: Direct relationships via featured media
    #     # featured_media_items = ArticleFeaturedMediaOrderable.objects.filter(image=image)
    #     # for media_item in featured_media_items:
    #     #     try:
    #     #         article = media_item.article_page
    #     #         if article and article.live and article.id not in article_ids:
    #     #             article_titles.append(article.title)
    #     #             article_ids.add(article.id)
    #     #     except Exception as e:
    #     #         print(f"Error with featured media for image {image.id}: {e}")
        
    #     # Method 2: Use ReferenceIndex to find ALL references
    #     try:
    #         # Get all references to the image
    #         references = ReferenceIndex.get_references_to(image)
                        
    #         # Extract the object_id values directly (these are the article IDs)
    #         article_ids_from_refs = set(references.values_list('object_id', flat=True))
            
    #         # If you want to get the actual article objects
    #         from article.models import ArticlePage
    #         articles = ArticlePage.objects.filter(id__in=article_ids_from_refs, live=True)
            
    #         for article in articles:
    #             article_titles.append(article.title)
    #             print(f"Found reference to article: {article.title} (ID: {article.id})")
    #     except Exception as e:
    #         print(f"Error accessing references for image {image.id}: {e}")        
    #     # Store the URL and all found article titles
    #     image_data.append({
    #         'url': url,
    #         'article_titles': article_titles
    #     })
    
    # # Write URLs to a text file with article titles
    # output_file = 'latest_image_urls.txt'
    # with open(output_file, 'w') as f:
    #     for data in image_data:
    #         f.write(f"Image URL: {data['url']}\n")
    #         if data['article_titles']:
    #             f.write("Used in articles:\n")
    #             for title in data['article_titles']:
    #                 f.write(f"  - {title}\n")
    #         f.write("\n")
    object_data.append({
        'url': 'http://ubyssey.storage.googleapis.com/media/wagtail_images/2015/10/Group-2_20131201__.jpg',
        'article_titles' : ['']
    })
    # get_image_tags(image_data)
    get_image_tags(object_data)
    return render(request, 'centennial.html', {})

def get_image_tags(image_data):
    _ = load_dotenv(find_dotenv())
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    # Process one image at a time
    all_tags = []
    all_descriptions = []

    for data in image_data:
        url = data['url']
        article_titles = data['article_titles']
        
        # Create article title context if it exists
        article_context = ""
        if article_titles:
            article_context = f"This image appears in these articles: {', '.join(article_titles)}. "
        
        prompt = f"Provide tags and description for this UBC campus image. Here are the article titles {article_context}\n\n" \
                 f"Consider URL clues about the subject. Include synonyms in your tags.\n\n" \
                 f"The tags and description is to make images more searchable by improving the search indexing.\n\n" \
                 f"If you cannot recognize the image, respond with 'sorry' only.\n\n" \
                 f"Format:\n" \
                 f"1. First line: 4-5 concise tags separated by commas\n" \
                 f"2. Second line: Detailed description for search indexing\n\n" \
                 f"Example:\n" \
                 f"campus, students, lecture, learning, education\n" \
                 f"A classroom at UBC with students attending a lecture."        
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": url}
                    }
                ]
            }
        ]

        try:
            print(f"Processing image: {url}")
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=1,
                max_tokens=1000,
                top_p=1,
                frequency_penalty=0,
                presence_penalty=0
            )
            content = response.choices[0].message.content
            print(content)
            # Check if the response indicates the image couldn't be recognized
            if "sorry" in content or "I can't help with that" in content or "I can't help with identifying or describing people in images" in content or "Sorry" in content:
                print(f"Skipping unrecognizable image: {url}")
                continue
            
            # Each response only contains one image's tags/description
            batch_tags, batch_descriptions = split_tags_and_description(content)
            all_tags.extend(batch_tags)
            all_descriptions.extend(batch_descriptions)
            
        except Exception as e:
            print(f"Error processing image: {e}")
            continue

    # Write results to CSV
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f'image_tags_{timestamp}.csv'

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Image URL', 'Article Titles', 'Tags', 'Description'])
        
        for i, (data, tag_list, description) in enumerate(zip(image_data[:len(all_tags)], all_tags, all_descriptions)):
            writer.writerow([
                data['url'],
                '; '.join(data['article_titles']),
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
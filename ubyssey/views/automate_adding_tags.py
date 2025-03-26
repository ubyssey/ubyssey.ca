from django.conf import settings
from django.shortcuts import render
from openai import AsyncOpenAI
from images.models import UbysseyImage
import os
import csv
from datetime import datetime
from django.db.models import Q
from wagtail.models.reference_index import ReferenceIndex
from article.models import ArticlePage
import asyncio
from asgiref.sync import async_to_sync, sync_to_async

def split_tags_and_description(input_string):
    """
    Parse OpenAI's response to extract tags and descriptions.
    
    Args:
        input_string (str): The response string from OpenAI containing tags and descriptions
        
    Returns:
        tuple: Contains two lists:
            - tags_list: List of lists, where each inner list contains tags for one image
            - descriptions_list: List of strings with descriptions for each image
    """
    
    # Remove any leading/trailing whitespace
    cleaned_input = input_string.strip()
    
    # Split by the first newline to separate tags from description
    parts = cleaned_input.split('\n', 1)
    
    description = ""
    if len(parts) >= 2:  # We have both tags and description
        tags = [tag.strip() for tag in parts[0].split(',')]
        description = parts[1].strip()

    elif len(parts) == 1 and parts[0]:  # Only tags, no description
        tags = [tag.strip() for tag in parts[0].split(',')]
                
    return tags, description

def get_image_urls(request):
    """
    Retrieve images from the database that haven't been tagged by OpenAI Vision 
    and find related articles for each image using ReferenceIndex.
    
    Args:
        request (HttpRequest): The Django request object used to build absolute URLs
    """
    
    # List of valid image extensions
    valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp', '.svg']
    
    # Create a Q object for each extension
    extension_filter = Q()
    for ext in valid_extensions:
        extension_filter |= Q(file__endswith=ext)

    images = []    
    images = UbysseyImage.objects.exclude(tags__name='Tagged by OpenAI Vision').filter(extension_filter).order_by("-created_at")

    iterate_images(images, request)

@async_to_sync
async def iterate_images(images, request):
    tasks = []
    max_at_a_time = 10
    counter = 0
    async for image in images:
        tasks.append(asyncio.create_task(process_image(image, request)))
        counter = counter + 1
        if len(tasks) >= max_at_a_time:
            print("---")
            await asyncio.gather(*tasks)
            print(f"{counter} / {len(images)}")
            await asyncio.sleep(0.5)
            tasks = []

    await asyncio.gather(*tasks)
    print(f"{counter} / {len(images)}")

async def process_image(image, request):
    data = await get_image_references(image, request)

    # Write URLs to a text file with article titles
    output_file = 'latest_image_urls.txt'
    with open(output_file, 'a') as f:
        
        f.write(f"Image URL: {data['url']}\n")
        if data['article_titles']:
            f.write("Used in articles:\n")
            for title in data['article_titles']:
                f.write(f"  - {title}\n")
        f.write("\n")
    
    processed_image, tag_list, description = await get_image_tags(data)
    if not (tag_list=="" and description == ""):
        await populate_tags(processed_image, tag_list, description)

@sync_to_async
def get_image_references(image, request):

    base_url = settings.MEDIA_URL
    url = request.build_absolute_uri(base_url + image.file.name)
    #print(url)
    
    article_titles = []
    try:
        # Get all references to the image
        references = ReferenceIndex.get_references_to(image)
                    
        # Extract the object_id values directly (these are the article IDs)
        article_ids_from_refs = set(references.values_list('object_id', flat=True))
        
        articles = ArticlePage.objects.filter(id__in=article_ids_from_refs, live=True)
        
        for article in articles:
            article_titles.append(article.title)
            #print(f"Found reference to article: {article.title} (ID: {article.id})")
    except Exception as e:
        print(f"Error accessing references for image {image.id}: {e}")  
    
    # Store the URL and all found article titles
    data = {
        'image': image,
        'url': url,
        'article_titles': article_titles
    }
    return data

async def get_image_tags(data):
    """
    Process images with OpenAI Vision to generate descriptive tags and detailed descriptions.
    
    Args:
        image_data (list): List of dictionaries containing image objects, URLs, and article titles
    """
    
    output_file = f'image_tags_processed.csv'
    client = AsyncOpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    url = data['url']
    article_titles = data['article_titles']
    image = data['image']
    
    # Create article title context if it exists
    article_context = ""
    if article_titles:
        article_context = f"This image appears in these articles: {', '.join(article_titles)}. "
    
    prompt = (f"Provide tags and description for this UBC campus image." + 
            (f" Here are the article titles: {article_context}" if article_titles else "") + 
            "\n\n"
            f"Consider URL clues about the subject. Include synonyms in your tags.\n\n"
            f"The tags and description is to make images more searchable by improving the search indexing.\n\n"
            f"For context these images are intended for UBC students.\n\n"
            f"Format:\n"
            f"1. First line: 4-5 concise tags separated by commas\n"
            f"2. Second line: Detailed description for search indexing\n\n"
            f"Example:\n"
            f"campus, students, lecture, learning, education\n"
            f"A classroom at UBC with students attending a lecture.")        
    
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
        #print(f"Processing image: {url}")
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=1,
            max_tokens=1000,
            top_p=1,
            frequency_penalty=0,
            presence_penalty=0
        )
        content = response.choices[0].message.content
        #print(content)
        # Check if the response indicates the image couldn't be recognized
        exclude = ["sorry", "i can't", "i'm unable to"]
        if True in [x in content.lower() for x in exclude]:
            print(f" - Skipping: {url}")
            print(f"     {content}")
            with open(output_file, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                #writer.writerow(['Image URL', 'Article Titles', 'Tags', 'Description'])
                
                writer.writerow([
                    data['url'],
                    '; '.join(data['article_titles']),
                    "UNRECOGNIZED",
                    "UNRECOGNIZED"
                ])
            return image, "", ""
        
        # Each response only contains one image's tags/description
        batch_tags, batch_descriptions = split_tags_and_description(content)
        tag_list = []
        description = ""
        if batch_tags and batch_descriptions:
            #print(batch_tags)
            #print(batch_descriptions)
            tag_list = batch_tags
            description = batch_descriptions
        
    except Exception as e:
        print(f" - Error processing image: {e}")
        with open(output_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            #writer.writerow(['Image URL', 'Article Titles', 'Tags', 'Description'])
            
            writer.writerow([
                data['url'],
                '; '.join(data['article_titles']),
                "ERROR",
                "ERROR"
            ])
        return image, "", ""

    with open(output_file, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        #writer.writerow(['Image URL', 'Article Titles', 'Tags', 'Description'])
        
        writer.writerow([
            data['url'],
            '; '.join(data['article_titles']),
            '; '.join(tag_list),
            description
        ])

    #print(f"Wrote results to {output_file}")
    return image, tag_list, description

async def populate_tags(image, tag_list, description):
    """
    Update images with AI-generated tags and descriptions
    
    Args:
        images: List of UbysseyImage objects
        tags: List of tag lists (each inner list contains tags for one image)
        descriptions: List of descriptions (one description per image)
    """

    #print(f"Adding tags to image: {image.id}")

    try:              
        for tag in tag_list:
            await sync_to_async(image.tags.add)(tag)
            
        tagged_ai = "Tagged by OpenAI Vision"
        await sync_to_async(image.tags.add)(tagged_ai)
    except Exception as e:
        tag_list_str = ",".join(tag_list)
        print(f" - Error saving image tags {image.id}\n    {tag_list_str}\n\n    {e}")  

    try:              
        image.description = "DESCRIPTION PROVIDED BY OPENAI VISION: " + description
        
        await image.asave()
        #print(f"Successfully updated image {image.id} with {len(tag_list)} tags")
    except Exception as e:
        print(f" - Error saving image description {image.id}\n    {description}\n\n    {e}")  
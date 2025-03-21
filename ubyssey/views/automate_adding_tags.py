from django.conf import settings
from django.shortcuts import render
from openai import OpenAI
from images.models import UbysseyImage
import os
from dotenv import load_dotenv, find_dotenv
import csv
from datetime import datetime
from django.db.models import Q
from wagtail.models.reference_index import ReferenceIndex
from article.models import ArticlePage

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
                
    return tags_list, descriptions_list

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
        
    images = UbysseyImage.objects.exclude(tags__name='Tagged by OpenAI Vision').filter(extension_filter).order_by("-created_at")[:10]
    base_url = settings.MEDIA_URL
    image_data = []
    
    for image in images:
        url = request.build_absolute_uri(base_url + image.file.name)
        print(url)
        
        article_titles = []
                
        try:
            # Get all references to the image
            references = ReferenceIndex.get_references_to(image)
                        
            # Extract the object_id values directly (these are the article IDs)
            article_ids_from_refs = set(references.values_list('object_id', flat=True))
            
            articles = ArticlePage.objects.filter(id__in=article_ids_from_refs, live=True)
            
            for article in articles:
                article_titles.append(article.title)
                print(f"Found reference to article: {article.title} (ID: {article.id})")
        except Exception as e:
            print(f"Error accessing references for image {image.id}: {e}")        
        
        # Store the URL and all found article titles
        image_data.append({
            'image': image,
            'url': url,
            'article_titles': article_titles
        })
    
    # Write URLs to a text file with article titles
    output_file = 'latest_image_urls.txt'
    with open(output_file, 'w') as f:
        for data in image_data:
            f.write(f"Image URL: {data['url']}\n")
            if data['article_titles']:
                f.write("Used in articles:\n")
                for title in data['article_titles']:
                    f.write(f"  - {title}\n")
            f.write("\n")
    
    get_image_tags(image_data)

def get_image_tags(image_data):
    """
    Process images with OpenAI Vision to generate descriptive tags and detailed descriptions.
    
    Args:
        image_data (list): List of dictionaries containing image objects, URLs, and article titles
    """
    
    _ = load_dotenv(find_dotenv())
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    # Process one image at a time
    all_tags = []
    all_descriptions = []
    processed_images = []
    
    for data in image_data:
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
                f"If you cannot recognize the image, respond with 'sorry' only.\n\n"
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
            if "sorry" in content.lower() or "I can't" in content:
                print(f"Skipping unrecognizable image: {url}")
                continue
            
            # Each response only contains one image's tags/description
            batch_tags, batch_descriptions = split_tags_and_description(content)
            if batch_tags and batch_descriptions:
                all_tags.extend(batch_tags)
                all_descriptions.extend(batch_descriptions)
                processed_images.append(image)  
            
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
    populate_tags(processed_images, all_tags, all_descriptions)

def populate_tags(images, tags, descriptions):
    """
    Update images with AI-generated tags and descriptions
    
    Args:
        images: List of UbysseyImage objects
        tags: List of tag lists (each inner list contains tags for one image)
        descriptions: List of descriptions (one description per image)
    """
    for image, tag_list, description in zip(images, tags, descriptions):
        print(f"Adding tags to image: {image.id}")
                
        for tag in tag_list:
            image.tags.add(tag)
            
        tagged_ai = "Tagged by OpenAI Vision"
        image.tags.add(tagged_ai)
        
        image.description = "DESCRIPTION PROVIDED BY OPENAI VISION: " + description
        
        image.save()
        print(f"Successfully updated image {image.id} with {len(tag_list)} tags")
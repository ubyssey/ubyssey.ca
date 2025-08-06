from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from wagtail.signals import page_published
from .models import ArticlePage, ArticleTopic
from django.utils.text import slugify
import asyncio
from asgiref.sync import async_to_sync, sync_to_async

@receiver(page_published)
def update_default_explicit_published_at(instance, sender, **kwargs):
    if issubclass(sender, ArticlePage):
        if not instance.explicit_published_at:
            instance.explicit_published_at = instance.first_published_at
            for author in instance.article_authors.all():
                author.author.last_activity = instance.first_published_at
                author.author.save()
            instance.save()

@receiver(page_published)
def update_primary_tag(instance, sender, **kwargs):
    '''
    On new tags, the primary tag field is set to the name of the tag 
    instead of the slug because the slug is not defined until after
    the page is published. So after we published and the tag is created,
    we set the primary tag field to the slug using this receiver.
    '''
    if issubclass(sender, ArticlePage):
        if not ArticleTopic.objects.filter(slug=instance.primary_tag_slug).exists() and instance.primary_tag_slug!="":
            tag = None
            if ArticleTopic.objects.filter(slug=slugify(instance.primary_tag_slug)).exists():
                tag =ArticleTopic.objects.get(slug=slugify(instance.primary_tag_slug))
            elif ArticleTopic.objects.filter(name=instance.primary_tag_slug).exists():
                tag =ArticleTopic.objects.get(name=instance.primary_tag_slug)
                
            if tag:
                instance.primary_tag_slug = tag.slug
                instance.save()

@receiver(page_published)
def update_topic_last_used_at(instance, sender, **kwargs):
    if issubclass(sender, ArticlePage):
        async def update_topic(topic):
            topic.tagged_articles_count = await sync_to_async(topic.get_count_of_tagged_articles)()

            if topic.last_used_at == None:
                topic.last_used_at = instance.first_published_at    
            elif topic.last_used_at >= instance.first_published_at:
                topic.last_used_at = instance.first_published_at

            await topic.asave()

        @async_to_sync
        async def process_topics():
            tasks = [asyncio.create_task(update_topic(topic)) async for topic in instance.topics.all()]
            await asyncio.gather(*tasks)
        
        process_topics()

'''
Removed because whatever this timeline thing is was never actually used
- Sam Low (6/08/2025)

@receiver(pre_save, sender=ArticlePage)
def update_timeline_on_article_alteration_pre_save(instance, **kwargs):
    #Examines the "timeline" field before an article is saved, and ensures it is updated when the article is saved.
    #If it has been changed, forces an update to the before and after timeline.

    if instance.id is not None:
        # previous_article represents the article as it currently exists in the database
        previous_version = ArticlePage.objects.get(id=instance.id)
        instance._old_timeline = previous_version.timeline
        #print("Set instance._old_timeline: ")
        #print(instance._old_timeline)
    else:
        # Exists to prevent AttributeError later
        instance._old_timeline = None
    return

@receiver(post_save, sender=ArticlePage)
def update_timeline_on_article_alteration_post_save(instance, **kwargs):

    if instance.timeline:
        instance.timeline.save()
    
        if instance._old_timeline:
            if instance.timeline != instance._old_timeline:
                # We should do a second update only if it turns out timeline changed since the save before our current one
                instance._old_timeline.save()
                return
    elif instance._old_timeline:
        instance._old_timeline.save()
    return

@receiver(post_delete, sender=ArticlePage)
def update_timeline_on_article_deletion(instance, **kwargs):
    """
    Forces update to timeline upon article deletion
    """
    if instance.timeline:
        instance.timeline.save()
'''
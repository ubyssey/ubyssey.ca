from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from wagtail.signals import page_published
from .models import ArticlePage
from taggit.models import Tag
from django.utils.text import slugify

@receiver(page_published, sender=ArticlePage)
def update_default_explicit_published_at(instance, **kwargs):
    if not instance.explicit_published_at:
        instance.explicit_published_at = instance.first_published_at
        for author in instance.article_authors.all():
            author.author.last_activity = instance.first_published_at
            author.author.save()
        instance.save()

@receiver(page_published, sender=ArticlePage)
def update_primary_tag(instance, **kwargs):
    '''
    On new tags, the primary tag field is set to the name of the tag 
    instead of the slug because the slug is not defined until after
    the page is published. So after we published and the tag is created,
    we set the primary tag field to the slug using this receiver.
    '''
    if not Tag.objects.filter(slug=instance.primary_tag_slug).exists() and instance.primary_tag_slug!="":
        tag = None
        if Tag.objects.filter(slug=slugify(instance.primary_tag_slug)).exists():
            tag =Tag.objects.get(slug=slugify(instance.primary_tag_slug))
        elif Tag.objects.filter(name=instance.primary_tag_slug).exists():
            tag =Tag.objects.get(name=instance.primary_tag_slug)
            
        if tag:
            instance.primary_tag_slug = tag.slug
            instance.save()

@receiver(pre_save, sender=ArticlePage)
def update_timeline_on_article_alteration_pre_save(instance, **kwargs):
    """
    Examines the "timeline" field before an article is saved, and ensures it is updated when the article is saved.

    If it has been changed, forces an update to the before and after timeline.
    """
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

from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import ArticlePage


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
        print("Set instance._old_timeline: ")
        print(instance._old_timeline)
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

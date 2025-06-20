"""
Blocks used on the home page of the site
"""
from wagtail import blocks
from article.models import ArticlePage
from django.utils import timezone
from django.utils.functional import cached_property


class LinksStreamBlock(blocks.StructBlock):

    links = blocks.ListBlock(
        blocks.StructBlock(
            [
                ('title', blocks.CharBlock(
                    required=True,
                    max_length=255,
                )),
                ('url',blocks.URLBlock(required=False)),
                ('description', blocks.TextBlock(required=False)),
            ],
        )
    )

    def get_context(self, value, parent_context=None):
        from events.models import Event
        from django.utils import timezone
        from datetime import timedelta
        context = super().get_context(value, parent_context)
        events = Event.objects.filter(hidden=False, end_time__gte=timezone.now()).exclude(category='seminar').order_by("start_time")[:15]
        context["ongoing"] = []
        context["upcoming"] = []
        today = timezone.now().astimezone(timezone.get_current_timezone())
        for i in range(len(events)):
            
            if events[i].start_time < today:
                pubdate = events[i].end_time.astimezone(timezone.get_current_timezone())
                display = "Ends "
            else:
                if len(context["ongoing"]) + len(context["upcoming"]) > 5:
                    break
                pubdate = events[i].start_time.astimezone(timezone.get_current_timezone())
                display = ""
                
            delta = abs(today - pubdate)

            if pubdate.date() == today.date():
                day = ""
            elif (pubdate - timedelta(days=1)).date() == today.date():
                day = "Tomorrow"
            elif delta.total_seconds() < timedelta(days=6).total_seconds():
                if events[i].start_time < today:
                    day = pubdate.strftime("%A")
                else:
                    day = pubdate.strftime("%a")
            else:
                day = pubdate.strftime("%B %-d") + ","

            time = ""
            if pubdate.hour != 0 and pubdate.hour != 23:
                time = " " + pubdate.strftime("%-I")
                if pubdate.strftime("%M") != "00":
                    time = time + pubdate.strftime(":%M")
                time = time + pubdate.strftime("%P")

            display = display + day + time
            events[i].display_time = display
            events[i].title = events[i].title.replace("<br>", ", ")

            if events[i].start_time < today:
                context["ongoing"].append(events[i])
            else:
                context["upcoming"].append(events[i])
        
        context["ongoing"].sort(key=lambda e: e.end_time)
        return context

    class Meta:
        template = "home/stream_blocks/links.html"

# Curated stream

class StorystreamItem(blocks.StructBlock):
    article = blocks.PageChooserBlock(page_type="article.ArticlePage")

    def render(self, value, context=None):
        context["article"] = value["article"]
        return value["article"].storystream_view[0].render_as_block(context=context)

class CuratedGroupHeadline(blocks.StructBlock):
    headline = blocks.CharBlock()
    style = blocks.ChoiceBlock(
        choices=[
            ('small', 'Small'),
            ('large', 'Large'),
        ],
        default='small',
        )
    link = blocks.URLBlock(required=False)

    class Meta:
        template = 'home/objects/group_headline.html'

class CuratedGroup(blocks.StructBlock):
    headline = blocks.StreamBlock([
            ('normal_headline', CuratedGroupHeadline())
        ],
        required=False,
        max_num=1
        )
    items = blocks.StreamBlock([
            ('storystream_item', StorystreamItem())
        ])

    class Meta:
        template = "home/objects/curated_group.html"


# Sidebar 

class RecentStoriesByDay(blocks.StructBlock):

    def get_recent_stories_by_day(self):
        print("whats gamed out?")
        cutoff = timezone.now() - timezone.timedelta(days=14)
        cutoff = cutoff.replace(hour=0, minute=0)
        articles = ArticlePage.objects.live().public().filter(first_published_at__gte=cutoff).order_by("-first_published_at")

        if len(articles) < 10:
            articles = ArticlePage.objects.live().public().order_by("-first_published_at")[:10]

        articlesByDate = []

        def format_date(datetime):
            today = timezone.now()
            if today.date() == datetime.date():
                return "Today"
            elif today.date() - timezone.timedelta(days=1) == datetime.date():
                return "Yesterday"
            else:
                return datetime.strftime("%B %d")

        for article in articles:
            if len(articlesByDate) > 0:
                if articlesByDate[-1]["day"] == format_date(article.first_published_at):
                    articlesByDate[-1]["articles"].append(article)
                    continue    
        
            articlesByDate.append({
                "day": format_date(article.first_published_at),
                "articles": [article]
            })

        return articlesByDate
    
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["recent_articles_by_day"] = self.get_recent_stories_by_day
        return context

    class Meta:
        template = "home/stream_blocks/recent_stories.html"
            



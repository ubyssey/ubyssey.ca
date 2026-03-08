"""
Blocks used on the home page of the site
"""
from wagtail.models import Site
from wagtail import blocks
from wagtail.documents.blocks import DocumentChooserBlock

from django.db.models import Q
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.safestring import mark_safe
from django.template.loader import render_to_string

from article.models import ArticlePage
from article.blocks_storystream import StoryStreamBlockTypes
from topics.views import cluster_articles_by_topic
import images.blocks as image_blocks


### Shared attachment options

# Left
class ProfileCell(blocks.StructBlock):
    image = blocks.ListBlock(image_blocks.ReducedImageBlock(), default=[], help_text="Optional!")
    text = blocks.RichTextBlock(required=False)
 
    def get_articles(self, value):
        return [value["article"]]

    class Meta:
        template = "home/objects/cells/profile.html"

class ProfileCellArticle(ProfileCell):
    article = blocks.PageChooserBlock(page_type="article.ArticlePage", required=False)
    
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context['article'] = value['article']
        return context

    def get_articles(self, value):
        if value["article"]:
            return [value["article"]]
        return []

class QuoteCell(blocks.StructBlock):

    audio = DocumentChooserBlock(required=False, help_text="Optional, file format: .m4a, .mp4, .mp, .wav, or .ogg")
    quote = blocks.TextBlock(required=False)

    style = blocks.ChoiceBlock(choices=[
        ("enlarged-quotation", "Enlarged quotation"),
        ("none", "None")
    ])

    article = blocks.PageChooserBlock(page_type="article.ArticlePage", required=False)
    label = blocks.CharBlock(required=False)

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        if value['audio']:
            if value['audio'].url[-4:] == '.wav':
                context['self'].format = 'wav'
            elif value['audio'].url[-4:] == '.mp3':
                context['self'].format = 'mpeg'
            elif value['audio'].url[-4:] == '.ogg':
                context['self'].format = 'ogg'
            else:
                context['self'].format = 'mp4'
        return context

    class Meta:
        template = "home/objects/cells/profile_quote.html"   


class SportsGameScore(blocks.StructBlock):
    teams = blocks.ListBlock(
        blocks.StructBlock([
            ('svg', DocumentChooserBlock()),
            ('name', blocks.TextBlock()),
            ('points', blocks.IntegerBlock(required=False)),
            ('style', blocks.ChoiceBlock(required=False, choices=[
                ('winner', 'Winner'),
                ('loser', 'Loser'),
                ])),
        ])
    )

    style = blocks.ChoiceBlock(required=True, choices=[
        ('vertical', 'Teams vertical'),
        ('horizontal', 'Teams horizontal'),
    ])

    article = blocks.PageChooserBlock(page_type="article.ArticlePage", required=False)

    title = blocks.TextBlock(required=False)
    link = blocks.URLBlock(required=False)

    def get_articles(self, value):
        return [value["article"]]

    class Meta:
        template = "home/objects/cells/sports_game_score.html"

class SharedAttachmentBasicArticleListing(blocks.StructBlock):
    article = blocks.PageChooserBlock(page_type="article.ArticlePage", required=True)

    template = blocks.ChoiceBlock(
        choices=[
            ('article_listing--minimal', "Minimal"),
            ('article_listing--minimal-lede', "Minimal with lede"),
        ],
        required=True,
    )

    def get_articles(self, value):
        return [value["article"]]

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        if '-lede' in value['template']:
            context['lede'] = True
        return context

    class Meta:
        template = "home/objects/cells/article_listing--minimal.html"

# Right
class AuthorCommentary(blocks.StructBlock):
    commentary = blocks.RichTextBlock(required=True)
    authors = blocks.ListBlock(blocks.PageChooserBlock(page_type="authors.AuthorPage"))

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        
        context["authors_with_urls"] = ",".join(map(lambda author: f"<a href='{author.full_url}'>{author.full_name}</a>", value["authors"]))

        return context

    class Meta:
        template = "home/objects/author_commentary.html"
    
class SharedAttachmentProfileGrid(blocks.StructBlock):
    profiles = blocks.StreamBlock([
        ("profile", ProfileCellArticle())
    ])
    style = blocks.ChoiceBlock(choices=[
        ("circle", "Circle"),
        ("square", "Square"),
        ("author", "Author")
    ])

    def get_articles(self, values):
        articles = []
        for i in self.to_python(values)['profiles']:
            if hasattr( i.block, 'get_articles' ) and callable( i.block.get_articles ):
                articles = articles + i.block.get_articles(i.get_prep_value()['value'])
        return articles

    class Meta:
        template = "home/objects/profile_grid.html"


class Carousel(blocks.StructBlock):
    items = blocks.ListBlock(blocks.StreamBlock([
        ("image", image_blocks.CaptionedImageBlock()),
        ("raw_html", blocks.RawHTMLBlock()),
        ("author_commentary", AuthorCommentary()),
        ("richtext", blocks.RichTextBlock()),
        ("profile_grid", SharedAttachmentProfileGrid()),
    ]))

    def get_articles(self, values):
        articles = []
        for item in self.to_python(values)['items']:
            for i in item:
                if hasattr( i.block, 'get_articles' ) and callable( i.block.get_articles ):
                    articles = articles + i.block.get_articles(i.get_prep_value()['value'])
        return articles

    class Meta:
        template = "home/objects/carousel.html"

### Mid Stream

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
    storystream_overwrite = blocks.StreamBlock(
        StoryStreamBlockTypes,
        blank = True,
        use_json_field=True,
        max_num = 1,
        required = False,
    )

    def get_articles(self, value):
        return [value["article"]]

    def render(self, value, context=None):
        article = value["article"]
        
        if not article.live:
            article = article.get_latest_revision_as_object()
        context["article"] = article

        if value["storystream_overwrite"]:
            return value["storystream_overwrite"][0].render_as_block(context=context)

        return article.storystream_view[0].render_as_block(context=context)

class CuratedStreamArticleList(blocks.StructBlock):
    articles = blocks.ListBlock(blocks.PageChooserBlock(page_type="article.ArticlePage"))
    template = blocks.ChoiceBlock(
        choices=[
            ('article_list--cards', "Cards"),
            ('article_list--cards-with-lede', "Cards with lede"),
            ('article_list--small-row', "Small row"),
        ],
        required=True,
    )

    def get_articles(self, value):
        return [article["value"] for article in value["articles"]]

    class Meta:
        template = "home/objects/curated_stream/article_list.html"

class CuratedGroupHeadline(blocks.StructBlock):
    headline = blocks.CharBlock()
    style = blocks.ChoiceBlock(
        choices=[
            ('small', 'Small'),
            ('medium', 'Medium'),
            ('large', 'Large'),
        ],
        default='small',
        )
    link = blocks.URLBlock(required=False)

    class Meta:
        template = 'home/objects/group_headline.html'

class CuratedGroupHeadlineRichtext(blocks.StructBlock):
    text = blocks.RichTextBlock()

    class Meta:
        template = 'home/objects/group_headline_richtext.html'

class CuratedStreamSharedAttachment(blocks.StructBlock):
    headline = blocks.StreamBlock([
        ('normal_headline', CuratedGroupHeadline()),
        ('richtext', CuratedGroupHeadlineRichtext()),
    ],
    required=False
    )

    left = blocks.StreamBlock([
        ("sports_game_score", SportsGameScore()),
        ("profile", ProfileCell()),
        ("quote", QuoteCell()),
        ("raw_html", blocks.RawHTMLBlock()),
        ("article_listing", SharedAttachmentBasicArticleListing()),
        ("richtext", blocks.RichTextBlock()),
        ("profile_grid", SharedAttachmentProfileGrid()),
    ])
    right = Carousel()

    def get_articles(self, values):
        articles = []

        for i in self.to_python(values)['left']:
            if hasattr( i.block, 'get_articles' ) and callable( i.block.get_articles ):
                articles = articles + i.block.get_articles(i.get_prep_value()['value'])

        articles = articles + self.to_python(values)['right'].block.get_articles(values['right'])

        return articles


    def render(self, value, context=None):
        #block_template = value.get('template')
        block_template = "shared_attachment"
        if block_template != '':
            template = f"home/objects/curated_stream/{block_template}.html"
        else:
            return self.render_basic(value, context=context)

        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        return mark_safe(render_to_string(template, new_context))

class CuratedStreamGrid(blocks.StructBlock):
    headline = blocks.StreamBlock([
        ('normal_headline', CuratedGroupHeadline()),
        ('richtext', blocks.RichTextBlock()),
    ],
    required=False
    )
    cells = blocks.ListBlock(blocks.StructBlock([
        ('article', blocks.PageChooserBlock(page_type="article.ArticlePage", required=False)),
        ('items', blocks.StreamBlock([
            ('profile', ProfileCell()),
            ("quote", QuoteCell()),
            ('raw_html', blocks.RawHTMLBlock()),
        ]))
    ]))
    rows = blocks.ChoiceBlock(choices=[
        ("one", "One"),
        ("two", "Two"),
        ("three", "Three"),
        ("four", "Four"),
        ("five", "Five"),
    ])
    layout = blocks.ChoiceBlock(choices=[
        ("headline_top", "Headline top"),
        ("headline_left", "Headline left"),
    ], default="headline_top")

    def get_articles(self, values):
        articles = []
        for i in values['cells']:
            articles = articles + [i["value"]["article"]]

        return articles

    class Meta:
        template = "home/objects/curated_stream/grid.html"


class CuratedGroup(blocks.StructBlock):
    headline = blocks.StreamBlock([
        ('normal_headline', CuratedGroupHeadline()),
        ('richtext', CuratedGroupHeadlineRichtext()),
    ],
    required=False
    )
    items = blocks.StreamBlock([
            ('storystream_item', StorystreamItem()),
            ('article_list', CuratedStreamArticleList()),
            ('shared_attachment', CuratedStreamSharedAttachment()),
            ('grid', CuratedStreamGrid())
        ])
    
    def get_articles(self, values):
        articles = []

        for i in self.to_python(values)['items']:
            articles = articles + i.block.get_articles(i.get_prep_value()['value'])

        return articles

    class Meta:
        template = "home/objects/curated_group.html"


# Sidebar 

class RecentStoriesByDay(blocks.StructBlock):

    def get_recent_stories_by_day(self, request):
        cutoff = timezone.now() - timezone.timedelta(days=14)
        cutoff = cutoff.replace(hour=0, minute=0)

        if request:
            site = Site.find_for_request(request)

            articleQuery = ArticlePage.objects.live().public().descendant_of(site.root_page).exclude(current_section__in = ["pages","about", "contact"])
        else:
            articleQuery = ArticlePage.objects.live().public().exclude(current_section__in = ["pages","about", "contact"])

        articles = articleQuery.filter(explicit_published_at__gte=cutoff).order_by("-explicit_published_at")

        if len(articles) < 10:
            articles = articleQuery.order_by("-explicit_published_at")[:10]


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
        request = None
        if "request" in parent_context:
            request = parent_context["request"]
        context["recent_articles_by_day"] = self.get_recent_stories_by_day(request)
        return context

    class Meta:
        template = "home/stream_blocks/recent_stories.html"
            

class RecentStoriesByTopic(blocks.StructBlock):

    def get_recent_stories_by_topic(self, exclude, request):       
        articleQuery = ArticlePage.objects.live().public().filter(timeliness__lte=ArticlePage.TimelinessChoices.A_FEW_DAYS.value).exclude(Q(page_ptr_id__in=exclude) | Q(current_section__in=["pages","about", "contact"])).order_by("-explicit_published_at")
        if request:
            site = Site.find_for_request(request)
            articleQuery = articleQuery.descendant_of(site.root_page)

        articles = articleQuery[:30]

        return cluster_articles_by_topic(considered_articles=articles, items=8, clusters=None)
    
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        exclude = []
        if "curated_articles" in parent_context:
            exclude = parent_context["curated_articles"]
        request = None
        if "request" in parent_context:
            request = parent_context["request"]
        context["get_recent_stories_by_topic"] = self.get_recent_stories_by_topic(exclude, request)
        return context

    class Meta:
        template = "home/stream_blocks/recent_stories--clustered.html"
            
class SidebarNewsletterSignup(blocks.StructBlock):
    text = blocks.RichTextBlock()
    form_placeholder = blocks.CharBlock()

    class Meta:
        template = "home/stream_blocks/newsletter_signup.html"
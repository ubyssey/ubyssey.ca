"""
Blocks used on the home page of the site
"""
from wagtail import blocks

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
from wagtail import blocks
from wagtail.embeds import blocks as embed_blocks

class OneOffVideoBlock(blocks.StructBlock):
    video_embed = embed_blocks.EmbedBlock(
        null=False,
        blank=False,
    )
    title = blocks.CharBlock(
        max_length=255,
        required=False,
    )
    caption = blocks.CharBlock(
        max_length=255,
        required=False,
    )
    credit = blocks.CharBlock(
        max_length=255,
        required=False,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)

        if value["video_embed"]:
            context["youtube_short"] = "/shorts/" in value["video_embed"].url

        return context

    class Meta:
        template = 'videos/stream_blocks/one_off_video.html'
        icon = 'media'

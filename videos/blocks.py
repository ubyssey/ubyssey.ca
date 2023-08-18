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

    class Meta:
        template = 'videos/stream_blocks/one_off_video.html'
        icon = 'media'
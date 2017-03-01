from dispatch.apps.frontend.helpers import templates
from dispatch.apps.frontend.templates import BaseTemplate
from dispatch.apps.frontend.fields import TextField, ModelField, SelectField

class Default(BaseTemplate):

    NAME = 'Default'
    SLUG = 'default'

    IMAGE_SIZE_OPTIONS = (
        ('default', 'Default'),
        ('full', 'Full')
    )

    fields = (
        ('image_size', 'Image Size', SelectField(options=IMAGE_SIZE_OPTIONS)),
    )

class FullWidth(BaseTemplate):

    NAME = 'Full width story'
    SLUG = 'fw-story'

    IMAGE_SIZE_OPTIONS = (
        ('default', 'Default'),
        ('full', 'Full')
    )

    HEADER_LAYOUT_OPTIONS = (
        ('right-image', 'Right Image'),
        ('top-image', 'Top Image'),
        ('banner-image', 'Banner Image')
    )

    fields = (
        ('description', 'Description', TextField()),
        ('image_size', 'Image Size', SelectField(options=IMAGE_SIZE_OPTIONS)),
        ('header_layout', 'Header Layout', SelectField(options=HEADER_LAYOUT_OPTIONS))
    )

class Guide(BaseTemplate):

    NAME = 'Guide to UBC'
    SLUG = 'guide-to-ubc'

    fields = (
        ('subheading', 'Sub-heading', TextField()),
        ('intro', 'Intro text', TextField()),
        ('next_a', 'Up next A', TextField()),
        ('next_b', 'Up next B', TextField())
    )

class Magazine(BaseTemplate):

    NAME = 'Magazine - Article'
    SLUG = 'magazine'

    COLOR_OPTIONS = (
        ('green', 'Green'),
        ('pink', 'Pink'),
        ('blue', 'Blue')
    )

    fields = (
        ('byline', 'Byline', TextField()),
        ('byline_2', 'Byline 2', TextField()),
        ('description', 'Description', TextField()),
        ('color', 'Accent Color', SelectField(options=COLOR_OPTIONS)),
    )

class MagazinePoem(BaseTemplate):

    NAME = 'Magazine - Poem'
    SLUG = 'magazine-poem'

    fields = (
        ('byline', 'Byline', TextField()),
        ('byline_2', 'Byline 2', TextField()),
        ('top_color', 'Top Color', TextField()),
        ('bottom_color', 'Bottom Color', TextField()),
        ('text_color_a', 'Text Color A', TextField()),
        ('text_color_b', 'Text Color B', TextField()),
        ('offset', 'Top Offset', TextField()),
    )


templates.register(Default)
templates.register(FullWidth)
templates.register(Guide)
templates.register(Magazine)
templates.register(MagazinePoem)

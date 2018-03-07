from dispatch.theme import register
from dispatch.theme.templates import Template
from dispatch.theme.fields import SelectField, CharField, TextField

@register.template
class Default(Template):
    id = 'default'
    name = 'Default'

    IMAGE_SIZE_OPTIONS = (
        ('default', 'Default'),
        ('full', 'Full')
    )

    image_size = SelectField('Image Size', options=IMAGE_SIZE_OPTIONS)

@register.template
class Blank(Template):
    id = 'blank'
    name = 'Blank'


@register.template
class FullWidth(Template):
    id = 'fw-story'
    name = 'Full width story'

    IMAGE_SIZE_OPTIONS = (
        ('default', 'Default'),
        ('full', 'Full')
    )

    HEADER_LAYOUT_OPTIONS = (
        ('right-image', 'Right Image'),
        ('top-image', 'Top Image'),
        ('banner-image', 'Banner Image')
    )

    description = TextField('Description')
    image_size = SelectField('Image Size', options=IMAGE_SIZE_OPTIONS)
    header_layout = SelectField('Header Layout', options=HEADER_LAYOUT_OPTIONS)

@register.template
class Guide(Template):
    id = 'guide-to-ubc'
    name = 'Guide to UBC'

    subheading = CharField('Sub-heading')
    intro = TextField('Intro text')
    next_a = CharField('Up next A')
    next_b = CharField('Up next B')

@register.template
class Magazine(Template):
    id = 'magazine'
    name = 'Magazine - Article'

    COLOR_OPTIONS = (
        ('green', 'Green'),
        ('pink', 'Pink'),
        ('blue', 'Blue')
    )

    DISPLAY_OPTIONS = (
        ('default', 'Default'),
        ('basic', 'Basic')
    )

    byline = TextField('Byline')
    byline_2 = TextField('Byline 2')
    description = TextField('Description')
    color = SelectField('Accent Color', options=COLOR_OPTIONS)
    display = SelectField('Display type', options=DISPLAY_OPTIONS)

@register.template
class MagazinePoem(Template):
    id = 'magazine-poem'
    name = 'Magazine - Poem'

    byline = TextField('Byline')
    byline_2 = TextField('Byline 2')
    top_color = CharField('Top Color')
    bottom_color = CharField('Bottom Color')
    text_color_a = CharField('Text Color A')
    text_color_b = CharField('Text Color B')
    offset = CharField('Top Offset')

@register.template
class VoteCompass(Template):
    id = 'vote-compass'
    name = 'Vote Compass'

    css = CharField('CSS')
    js = CharField('JavaScript')

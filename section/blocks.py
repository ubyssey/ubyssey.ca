from wagtail import blocks

class SectionHeading(blocks.StructBlock):

    class Meta:
        template = "section/objects/section_heading.html"

class SectionCategoryBar(blocks.StructBlock):

    class Meta:
        template = "section/objects/category_bar.html"
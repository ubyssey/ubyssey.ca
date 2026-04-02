from wagtail import blocks

class SectionHeading(blocks.StructBlock):
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["section"] = parent_context["page"]
        context["parent"] = parent_context["page"].get_parent()
        return context

    class Meta:
        template = "section/objects/section_heading.html"

class SectionCategoryBar(blocks.StructBlock):
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)

        return context

    class Meta:
        template = "section/objects/category_bar.html"
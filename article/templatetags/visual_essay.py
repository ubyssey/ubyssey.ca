from django import template

register = template.Library()

@register.filter(name="get_first_image")
def get_first_image(blocks):
    for i in range(len(blocks)):
        if blocks[i].block_type == "image":
            return i
    return None
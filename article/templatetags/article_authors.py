from django import template

register = template.Library()

@register.filter
def all_no_images(authors):
    if authors[0].author.display_image == False:
        return all(author.author.display_image == authors[0].author.display_image for author in authors)
    else:
        return True
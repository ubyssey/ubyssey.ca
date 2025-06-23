from wagtail import blocks

class NewsletterSignupBlock(blocks.StructBlock):

    text = blocks.RichTextBlock(required=True)

    input_text = blocks.CharBlock(required=True)

    class Meta:
        template = "newsletter/newsletter_signup_form.html"
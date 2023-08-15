import json
import random

from dispatch.models import (
    Article,
    Author,
    Image,
    ImageAttachment,
    ImageGallery,
    Page,
    Person,
    Section,
    Tag,
    Topic,
)
from django.core.management.base import BaseCommand
from django.db import connections
from django.utils.timezone import get_current_timezone, make_aware

errors = []


def dictfetchall(cursor):
    "Return all rows from a cursor as a dict"
    columns = [col[0] for col in cursor.description]
    return [dict(list(zip(columns, row))) for row in cursor.fetchall()]


def get_template_data(article):
    cursor = connections["legacy"].cursor()
    cursor.execute(
        """
        SELECT * FROM frontend_templatevariable
            WHERE article_id = %s
            AND template_slug = %s
        """,
        [article.id, article.template],
    )

    result = {}

    for row in dictfetchall(cursor):
        result[row["variable"]] = row["value"]

    return result


def convert_content(content):
    def convert_paragraph(data):
        return {"type": "paragraph", "data": data}

    def convert_image(data):
        attachment = ImageAttachment.objects.get(id=data["attachment_id"])
        return {
            "type": "image",
            "data": {
                "image_id": attachment.image_id,
                "caption": attachment.caption,
                "credit": attachment.credit,
            },
        }

    new_content = []

    try:
        old_content = json.loads(content)
    except:
        print("ERROR ERROR 1")
        print(content)
        print()
        return new_content

    for block in old_content:
        try:
            if isinstance(block, str):
                new_content.append(convert_paragraph(block))
            elif block["type"] == "image":
                new_content.append(convert_image(block["data"]))
            elif block["type"] == "advertisement":
                # Ignore ads
                pass
            else:
                new_content.append(block)
        except:
            print("ERROR ERROR 2")
            print(block)
            print()

    return new_content


def set_timezone(date):
    if date is None:
        return date
    return make_aware(date, get_current_timezone(), is_dst=False)


def migrate_articles():
    print("Articles...")
    # Clear table
    Article.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_article")
    for row in dictfetchall(cursor):
        try:
            new_article = Article(
                # Ids
                id=row["id"],
                # parent_id=row['parent_id'],
                revision_id=row["revision_id"],
                head=row["head"],
                is_published=row["is_published"],
                is_active=row["is_active"],
                slug=row["slug"],
                shares=row["shares"],
                views=row["views"],
                # Template
                template=row["template"],
                # SEO
                seo_keyword=row["seo_keyword"],
                seo_description=row["seo_description"],
                integrations={},
                snippet=row["snippet"],
                created_at=set_timezone(row["created_at"]),
                updated_at=set_timezone(row["updated_at"]),
                published_at=set_timezone(row["published_at"]),
                # Article fields
                headline=row["headline"],
                section_id=row["section_id"],
                topic_id=row["topic_id"],
                importance=row["importance"],
                reading_time=row["reading_time"],
            )

            new_article.save(revision=False)

            cursor.execute(
                "SELECT * FROM content_article_tags WHERE article_id = %s",
                [new_article.id],
            )
            for t in dictfetchall(cursor):
                tag = Tag.objects.get(id=t["tag_id"])
                new_article.tags.add(tag)

            template_data = get_template_data(new_article)

            print(
                "Article %d, parent %d -- %s"
                % (new_article.id, row["parent_id"], new_article.headline)
            )
            # print template_data

            new_article.parent_id = row["parent_id"]
            new_article.template_data = template_data
            new_article.save(revision=False)
        except:
            errors.append(row)


def migrate_article_content():
    print("Article content...")

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_article")
    for row in dictfetchall(cursor):
        try:
            article = Article.objects.get(id=row["id"])
            article.content = convert_content(row["content"])
            article.save(revision=False)
            print("Article %d" % article.id)
        except:
            errors.append(row)


def migrate_page_content():
    print("Page content...")

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_page")
    for row in dictfetchall(cursor):
        try:
            page = Page.objects.get(id=row["id"])
            page.content = convert_content(row["content"])
            page.save(revision=False)
            print("Page %d" % page.id)
        except:
            errors.append(row)


def migrate_featured_images():
    print("Featured images...")

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_article")
    for row in dictfetchall(cursor):
        try:
            article = Article.objects.get(id=row["id"])
            article.featured_image_id = row["featured_image_id"]
            article.save(revision=False)
            print("Article %d" % article.id)
        except:
            errors.append(row)
            # print 'ERROR: Article %s, feat image %d' % (article.slug, row['featured_image_id'])

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_page")
    for row in dictfetchall(cursor):
        try:
            page = Page.objects.get(id=row["id"])
            page.featured_image_id = row["featured_image_id"]
            page.save(revision=False)
            print("Page %d" % page.id)
        except:
            errors.append(row)


def migrate_pages():
    print("Pages...")

    # Clear table
    Page.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_page")
    for row in dictfetchall(cursor):
        try:
            new_page = Page(
                # Ids
                id=row["id"],
                # parent_id=row['parent_id'],
                revision_id=row["revision_id"],
                head=row["head"],
                is_published=row["is_published"],
                is_active=row["is_active"],
                slug=row["slug"],
                shares=row["shares"],
                views=row["views"],
                # Template
                template=row["template"],
                # SEO
                seo_keyword=row["seo_keyword"],
                seo_description=row["seo_description"],
                integrations={},
                snippet=row["snippet"],
                created_at=set_timezone(row["created_at"]),
                updated_at=set_timezone(row["updated_at"]),
                published_at=set_timezone(row["published_at"]),
                # Page fields
                title=row["title"],
            )

            new_page.save(revision=False)

            print(
                "Page %d, parent %d -- %s"
                % (new_page.id, row["parent_id"], new_page.title)
            )
            # print

            new_page.parent_id = row["parent_id"]
            new_page.parent_page_id = row["parent_page_id"]
            new_page.save(revision=False)
        except:
            errors.append(row)


def migrate_persons():
    print("Persons...")

    # Clear table
    Person.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM core_person")
    for row in dictfetchall(cursor):
        new_person = Person(
            id=row["id"],
            full_name=row["full_name"],
            is_admin=row["is_admin"],
            image=row["image"],
            slug=row["slug"],
            description=row["description"],
            title=row["title"],
        )

        # print 'Person %d, %s' % (new_person.id, new_person.full_name)

        try:
            new_person.save()
        except:
            new_person.slug = new_person.slug + "-%d" % random.randint(1, 9)
            new_person.save()


def migrate_images():
    print("Images...")

    # Clear table
    # Image.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_image")
    for row in dictfetchall(cursor):
        try:
            # new_image = Image(
            #     id=row['id'],
            #     img=row['img'],
            #     title=row['title'],
            #     width=row['width'],
            #     height=row['height'],
            #     created_at=set_timezone(row['created_at']),
            #     updated_at=set_timezone(row['updated_at'])
            # )

            image = Image.objects.get(pk=row["id"])
            image.img = row["img"]
            image.save()

            print("Image %d, %s" % (image.id, image.img))
            # new_image.save()
        except:
            print("ERROR: Image %d, %s not saved" % (row["id"], row["img"]))


def migrate_sections():
    print("Sections...")

    Section.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_section")

    for row in dictfetchall(cursor):
        try:
            new_section = Section(id=row["id"], name=row["name"], slug=row["slug"])
            new_section.save()
        except:
            errors.append(row)

        print("Section %s %s" % (new_section.name, new_section.slug))


def migrate_attachments():
    print("Attachents...")

    # Clear table
    ImageAttachment.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_imageattachment")
    for row in dictfetchall(cursor):
        try:
            caption = row["caption"] if row["caption"] != "None" else None
            new_attachment = ImageAttachment(
                id=row["id"],
                caption=caption,
                credit=row["custom_credit"],
                order=row["order"],
                article_id=row["article_id"],
                page_id=row["page_id"],
                gallery_id=row["gallery_id"],
                image_id=row["image_id"],
            )

            print(
                "Image attachment %d, %s" % (new_attachment.id, new_attachment.caption)
            )
            new_attachment.save()
        except Exception as e:
            print(e)
            print(
                "ERROR: Image attachment %d, %s"
                % (new_attachment.id, new_attachment.caption)
            )


def migrate_authors():
    print("Authors...")
    # Clear table
    Author.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_author")
    for row in dictfetchall(cursor):
        try:
            new_author = Author(
                id=row["id"],
                order=row["order"],
                article_id=row["article_id"],
                image_id=row["image_id"],
                person_id=row["person_id"],
            )

            print("Author %d" % new_author.id)
            new_author.save()
        except:
            errors.append(row)
            # print 'ERROR Author %d' % row['id']


def migrate_versions():
    print("Versions...")

    for a in Article.objects.filter(head=True):
        try:
            published_version = Article.objects.get(
                parent=a.parent, is_published=True
            ).revision_id
        except:
            published_version = None

        latest_version = a.revision_id

        Article.objects.filter(parent=a.parent).update(
            published_version=published_version, latest_version=latest_version
        )

        print(
            "Article %d - latest: %d, published: %d"
            % (a.parent_id, latest_version, published_version or 0)
        )

    for a in Page.objects.filter(head=True):
        try:
            published_version = Page.objects.get(
                parent=a.parent, is_published=True
            ).revision_id
        except:
            published_version = None

        latest_version = a.revision_id

        Page.objects.filter(parent=a.parent).update(
            published_version=published_version, latest_version=latest_version
        )

        print(
            "Page %d - latest: %d, published: %d"
            % (a.parent_id, latest_version, published_version or 0)
        )


def migrate_tags():
    print("Tags...")

    Tag.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_tag")
    for row in dictfetchall(cursor):
        tag = Tag(id=row["id"], name=row["name"])
        tag.save()
        print("Tag %s" % tag.name)


def migrate_topics():
    print("Topics...")

    Topic.objects.all().delete()

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_topic")
    for row in dictfetchall(cursor):
        topic = Topic(id=row["id"], name=row["name"])
        topic.save()
        print("Topic %s" % topic.name)


def migrate_imagegallery():
    print("Galleries...")

    cursor = connections["legacy"].cursor()
    cursor.execute("SELECT * FROM content_imagegallery")

    for row in dictfetchall(cursor):
        new_gallery = ImageGallery(id=row["id"], title=row["title"])
        new_gallery.save()


def migrate_imagegallery_images():
    print("Gallery images...")

    cursor = connections["legacy"].cursor()
    for gal in ImageGallery.objects.all():
        cursor.execute(
            "SELECT * FROM content_imagegallery_images WHERE imagegallery_id = %s",
            [gal.id],
        )
        print("Gallery %d, %s" % (gal.id, gal.title))
        gal.images.clear()
        for img in dictfetchall(cursor):
            try:
                attach = ImageAttachment.objects.get(id=img["imageattachment_id"])
                print("  Attachment %d" % attach.id)
                gal.images.add(attach)
            except:
                errors.append(img)


class Command(BaseCommand):
    def add_arguments(self, parser):
        # Positional arguments
        # parser.add_argument('table', nargs='+', type=str)
        pass

    def handle(self, *args, **options):
        # migrate_persons()
        # return
        migrate_images()
        # migrate_tags()
        # migrate_topics()
        # migrate_sections()
        # migrate_articles()
        # migrate_pages()
        # migrate_authors()
        # migrate_imagegallery()
        # migrate_attachments()
        # migrate_featured_images()
        # migrate_article_content()
        # migrate_page_content()
        # migrate_versions()
        # migrate_imagegallery_images()

        print(errors)

        # table = options['table'][0]

        # if table == 'articles':
        #     return migrate_articles()
        # if table == 'pages':
        #     return migrate_pages()
        # if table == 'persons':
        #     return migrate_persons()
        # if table == 'images':
        #     return migrate_images()
        # if table == 'attachments':
        #     return migrate_attachments()
        # if table == 'article_content':
        #     return migrate_article_content()
        # if table == 'page_content':
        #     return migrate_page_content()
        # if table == 'featured_images':
        #     return migrate_featured_images()
        # if table == 'authors':
        #     return migrate_authors()
        # if table == 'versions':
        #     return migrate_versions()

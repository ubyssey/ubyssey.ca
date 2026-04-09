import csv
import os
import traceback
from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from article.models import ArticlePage, ArticleAuthorsOrderable, StaticArticlePage
from authors.models import AllAuthorsPage, AuthorPage
from section.models import SectionPage


ARCHIVE_BASE = os.path.normpath(os.path.join(
    os.path.dirname(__file__),
    '..', '..', '..', '..', '..', 'ubyssey-static-archive',
))
MANIFEST_PATH = os.path.join(ARCHIVE_BASE, 'manifest.csv')
AUTHORS_PATH = os.path.join(ARCHIVE_BASE, 'authors.csv')
SKIP_PATH = os.path.join(ARCHIVE_BASE, 'skip.txt')
FAILED_LOG_PATH = os.path.join(ARCHIVE_BASE, 'import_failed.log')


def load_authors_csv():
    """Return a dict mapping old_author_slug -> {new_slug, new_name}."""
    with open(AUTHORS_PATH, newline='', encoding='utf-8') as f:
        return {
            row['old_author_slug'].strip(): {
                'new_slug': row['new_author_slug'].strip(),
                'new_name': row['new_author_name'].strip(),
            }
            for row in csv.DictReader(f)
        }


def load_skip_ids():
    with open(SKIP_PATH, encoding='utf-8') as f:
        return {line.strip() for line in f if line.strip()}


def parse_published_at(value):
    try:
        dt = datetime.fromisoformat(value)
        return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
    except ValueError:
        return None


def get_or_create_author(author_username, author_name, authors_csv, author_pages, authors_page):
    """
    Resolve an AuthorPage for the given manifest author fields.
    Creates a new AuthorPage under authors_page if one doesn't exist yet.
    Returns None if no slug can be determined.
    """
    info = authors_csv.get(author_username)
    new_slug = info['new_slug'] if info else author_username
    new_name = info['new_name'] if info else author_name

    if not new_slug:
        return None

    if new_slug in author_pages:
        return author_pages[new_slug]

    author_page = AuthorPage(title=new_name, slug=new_slug, full_name=new_name)
    authors_page.add_child(instance=author_page)
    author_page.save_revision().publish()

    author_pages[new_slug] = author_page
    return author_page, True


def create_article_page(row, parent_page, author_page):
    slug = row['slug']
    published_at = parse_published_at(row['published_at'])

    page = StaticArticlePage(title=row['title'], slug=slug, static_file=row['file_location'])
    parent_page.add_child(instance=page)

    if author_page is not None:
        ArticleAuthorsOrderable.objects.create(article_page=page, author=author_page)

    page.first_published_at = published_at
    page.last_published_at = published_at
    page.save_revision().publish()

    return page


class Command(BaseCommand):
    help = 'Import archived articles from ubyssey-static-archive into Wagtail as StaticArticlePages'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        authors_csv = load_authors_csv()
        author_pages = {p.slug: p for p in AuthorPage.objects.all()}
        authors_page = AllAuthorsPage.objects.first()
        section_pages = {p.slug: p for p in SectionPage.objects.all()}
        skip_ids = load_skip_ids()
        existing_slugs = set(ArticlePage.objects.values_list('slug', flat=True))

        skipped = imported = failed = 0

        log = open(FAILED_LOG_PATH, 'w', encoding='utf-8') if not dry_run else None
        try:
            with open(MANIFEST_PATH, newline='', encoding='utf-8') as f:
                for row in csv.DictReader(f):
                    row = {k: v.strip() for k, v in row.items()}

                    if row['id'] in skip_ids or row['slug'] in existing_slugs:
                        skipped += 1
                        continue

                    if not row['file_location']:
                        self._fail(log, 'missing_file_location', row)
                        failed += 1
                        continue

                    parent_page = section_pages.get(row['category'])
                    if parent_page is None:
                        self._fail(log, 'no_section', row, f"category={row['category']}")
                        failed += 1
                        continue

                    if dry_run:
                        self.stdout.write(f"  WOULD IMPORT: [{row['category']}] {row['slug']} — \"{row['title']}\"")
                        imported += 1
                        continue

                    try:
                        author_page = get_or_create_author(
                            row['author_username'], row['author'],
                            authors_csv, author_pages, authors_page,
                        )
                        if isinstance(author_page, tuple):
                            author_page, _ = author_page
                            self.stdout.write(f"    CREATED AUTHOR: {author_page.slug}")

                        create_article_page(row, parent_page, author_page)
                        existing_slugs.add(row['slug'])
                        imported += 1
                        self.stdout.write(f"  IMPORTED: [{row['category']}] {row['slug']}")

                    except Exception:
                        log.write(f"exception\t{row['id']}\t{row['slug']}\n{traceback.format_exc()}\n")
                        self.stdout.write(self.style.ERROR(f"  FAIL (exception): {row['slug']}"))
                        failed += 1
        finally:
            if log:
                log.close()

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. imported={imported}, skipped={skipped}, failed={failed}'
        ))
        if not dry_run and failed:
            self.stdout.write(f'Failed imports logged to: {FAILED_LOG_PATH}')

    def _fail(self, log, reason, row, detail=''):
        self.stdout.write(self.style.WARNING(f"  FAIL ({reason}): {row['slug']}"))
        if log:
            log.write(f"{reason}\t{row['id']}\t{row['slug']}\t{detail}\n")

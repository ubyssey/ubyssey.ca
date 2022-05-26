import React from 'react'
import ReactDOM from 'react-dom'
import './modules/Youtube'
import { ArticlesSuggested } from './components/Article'
import { Poll } from './components/Poll'
import Search from './components/Search.jsx';
import { AdblockSplash, CookieDisclaimer } from './components/Cookies'
import { Galleries } from './components/Gallery'
import Timeline from './components/Timeline.jsx'
import Episode from './components/Podcast/Episode.jsx'


window.articleHeader = false;

const BOX_HEIGHT = 274
const SKYSCRAPER_HEIGHT = 624

$(function () {
    // 2022/05/25 — Widget polls are a removed feature and the below is therefore unused
    $('.c-widget-poll').each(function () {
        ReactDOM.render(
            <Poll id={$(this).data('id')} loaderHTML={$(this).html()} />,
            $(this).get(0)
        )
    })
    // 2022/05/25 — Adblock response is not a maintained feature e and the below is therefore unused
    ReactDOM.render(
        <AdblockSplash />,
        document.getElementById('adblock-splash')
    )
    // 2022/05/25 - Cookie disclaimer IS used.
    // HOWEVER it must be capable of appearing on ANY page on the site
    // Its presence in JavaScript associated with ARTICLES seems confusing, code smell
    ReactDOM.render(
        <CookieDisclaimer />,
        document.getElementById('cookie-disclaimer')
    )
    // 2022/05/25 - Timelines ARE used; note however they require very heavy lifting from the backend.
    // Consider isolating timeline related scripts in the static folder corresponding to the template
    // folder in its own Django app so that feature-relevant code is "all in one place".
    // Having timeline frontend in this file feels like it's "hiding" functionality which is
    // required to be "magic" 
    $('.c-timeline').each(function () {
        ReactDOM.render(
            <Timeline id={$(this).data('currentArticleId')}
                title={$(this).data('timelineTitle')}
                nodes={$(this).data('nodes')} />,
            $(this).get(0)
        )
    })
    // 2022/05/25 - Podcast episodes are a removed feature
    $('.c-podcast-episode').each(function () {
        ReactDOM.render(
            <Episode author={$(this).data('author')}
                description={$(this).data('description')}
                file={$(this).data('file')}
                image={$(this).data('image')}
                publishedAt={$(this).data('published_at')}
                id={$(this).data('id')}
                title={$(this).data('title')}
            />,
            $(this).get(0)
        )
    })
});

if ($('main.article').length) {

    const $article = $('article');

    var articleId = $article.data('id');
    var articleHeadline = $article.data('headline');
    var articleURL = $article.data('url');

    var userId = $article.data('user-id');

    var articleIds = $article.data('list');
    var listName = $article.data('list-name');
    if (articleIds === parseInt(articleIds, 10)) {
        articleIds = [articleIds];
    } else {
        articleIds = articleIds.split(',');
    }

    var firstArticle = {
        id: articleId,
        headline: articleHeadline,
        url: articleURL
    };

    // 2022/05/25 - Sticky ads have never worked correctly and caused more complaints than anything
    // Inteded functionality not clear.
    // Strong candidate for permanent removal
    function stickyAds(scrollTop, stickyElements) {

        const headerHeight = $('.topbar').outerHeight(true)
        var sidebar = $('.sidebar');
        if (sidebar.length) {
            var sidebarOffset = sidebar.offset().top + $('#content-wrapper').scrollTop()
            if (headerHeight === null || typeof headerHeight === 'undefined') {
                return null
            }
        }

        stickyElements.map(element => {
            // adjust when skyscraper is served
            if (element.height !== $(element.element).height() && element.index == 0) {
                element.height = $(element.element).height()
            }

            const dropoff = element.offset + element.scrollDistance - element.height
            const pickup = element.offset - headerHeight
            const articleBottom = $('#content-wrapper').scrollTop() + $('.article-content').offset().top + $('.article-content').outerHeight() - element.height

            // Dropoff bottom
            if (scrollTop > dropoff || scrollTop > articleBottom) {
                if (!element.dropoff) {
                    element.dropoff = scrollTop - sidebarOffset
                }
                const topOffset = String(element.dropoff + headerHeight) + 'px'
                // const topOffset = String( element.dropoff ) + 'px'
                element.element.css('position', 'absolute')
                element.element.css('top', topOffset)
            }
            // Pickup
            else if (scrollTop > pickup) {
                const topOffset = String(headerHeight) + 'px'
                element.element.css('position', 'fixed')
                element.element.css('top', topOffset)
            }
            // Dropoff top last element
            else {
                const topOffset = String(element.offset - sidebarOffset) + 'px'
                element.element.css('position', 'absolute')
                element.element.css('top', topOffset)
            }
        })
    }

    function articleAds() {
        $(function () {
            // Desktop
            if ($(window).width() >= 960) {
                const sidebarHeight = $('.sidebar').find('[class*="c-widget"]').outerHeight(true) || 0
                const adSpace = ($('.article-content').height() - sidebarHeight - $('.right-column').height())

                $('.sidebar').find('[class*="o-advertisement--"]').addClass('js-sticky')
                const stickyElementLength = $('.js-sticky').length

                if (adSpace < 0) {
                    $('.sidebar').remove()
                    console.warn('Insufficient space: sidebar removed', adSpace)
                    return
                }
                if (adSpace < BOX_HEIGHT) {
                    $('.sidebar').find('.o-advertisement--box').remove()
                    console.warn('Insufficient space: box ads blocked', adSpace)
                    return
                }
                if (adSpace < SKYSCRAPER_HEIGHT) {
                    $('.sidebar').find('.o-advertisement--skyscraper').remove()
                    console.warn('Insufficient space: skyscraper ads blocked', adSpace)
                    return
                }

                // Create sticky elements
                let stickyElements = []

                $('.js-sticky').each(function (index) {
                    const element = {
                        element: $(this),
                        index: index,
                        offset: $(this).offset().top + $('#content-wrapper').scrollTop() + index * adSpace / stickyElementLength,
                        dropoff: null,
                        height: $(this).height(),
                        scrollDistance: adSpace / stickyElementLength
                    }
                    stickyElements.push(element)
                })

                // Adjust last sticky element's offset
                if (stickyElements.length > 1) {
                    stickyElements[stickyElements.length - 1].offset = stickyElements[stickyElements.length - 1].offset - stickyElements[stickyElements.length - 1].height / 2
                }

                // Sticky Ads
                $('#content-wrapper').scroll(() => {
                    const scrollTop = $('#content-wrapper').scrollTop();
                    stickyAds(scrollTop, stickyElements)
                })
            }
        })
    }

    // Why even name this function if we're just going to immediately invoke it where it was defined, like an anonymous function?
    // It's not for documentation's sake; no one's been able to understand this function anyways.
    // Code smell, suggests this was written by someone that does not understand JavaScript
    articleAds()

    // Pointless "article list" code. "Suggested articles" is not a well defined feature for the site;
    // while it is currently being reworked, there's no reason not to simply describe the elements involved using HTML.
    // This separates the description of the element into a different language.
    // It requires anyone who wants maintain a feature that would USUALLY have been done in HTML on our site know React.
    // Such code as this makes sense when making a Single Page App (SPA), but only causes trouble here
    if (document.getElementById('article-list') !== null) {
        const articleList = ReactDOM.render(
            <ArticlesSuggested
                breakpoint={960}
                name={listName}
                currentArticle={firstArticle}
                articles={articleIds}
                userId={userId} />,
            document.getElementById('article-list')
        );
    }

    // 2022/05/25 - Galleries are a good idea, but broken. For all the below the best idea is likely "preserve and debug"
    const gatherImages = (gallery) => {
        var selector, trigger;

        if (gallery) {
            const id = $(gallery).data("id");
            selector = `#gallery-${id} .gallery-image`;
            trigger = `#gallery-${id} .gallery-thumb`;
        } else {
            selector = `#article-${articleId} .article-attachment`;
            trigger = `#article-${articleId} .article-attachment`;
        }

        const images = $(selector).map((_, el) => {
            const $el = $(el);
            return {
                id: $el.data('id'),
                url: $el.data('url'),
                style: $el.data('style'),
                caption: $el.data('caption'),
                credit: $el.data('credit'),
                width: $el.width(),
                height: $el.height()
            };
        }).get();

        const imagesTable = images.reduce((table, image, i) => {
            table[image.id] = i;
            return table;
        }, {});

        return {
            selector,
            trigger,
            title: gallery ? $(gallery).data('id') : 'Images',
            list: images,
            table: imagesTable,
        };
    };


    const galleries = [
        gatherImages(),
        ...$(`#article-${articleId} .gallery-attachment`)
            .map((_, elem) => gatherImages(elem)).get()
    ];



    const gallery = ReactDOM.render(
        <Galleries galleries={galleries} />,
        document.getElementById('gallery')
    );


}

// 2022/05/25 - Search forms need fixing but are a feature we intend to maintain into the future
// Since all that's being done here is rendering an element, the question comes up again, why bother with React at all?
// Why not just do it with HTML? It's not like we're responsively narrowing down search requests as the user types,
// All that we can reasonably do is send an HTTP request with POST content, and get a normal response from the backend
// no AJAX dynamic webpage. Which is bare bones webdev that doesn't require React.
ReactDOM.render(
    <Search />,
    document.getElementById('search-form')
);

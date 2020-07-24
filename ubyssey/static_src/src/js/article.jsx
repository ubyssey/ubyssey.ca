import React from 'react'
import ReactDOM from 'react-dom'
import './modules/Youtube'
import { ArticlesSuggested } from './components/Article'
import { Poll } from './components/Poll'
import Search from './components/Search.jsx';
import { Splash, CookieDisclaimer } from './components/Cookies'
import { Galleries } from './components/Gallery'
import Timeline from './components/Timeline.jsx'
import Episode from './components/Podcast/Episode.jsx'
import { Nationals } from './components/Nationals'

window.articleHeader = false;

const BOX_HEIGHT = 274
const SKYSCRAPER_HEIGHT = 624

$(function () {
    $('.c-widget-poll').each(function () {
        ReactDOM.render(
            <Poll id={$(this).data('id')} loaderHTML={$(this).html()} />,
            $(this).get(0)
        )
    })
    ReactDOM.render(
        <Splash />,
        document.getElementById('ubyssey-splash')
    )
    ReactDOM.render(
        <CookieDisclaimer />,
        document.getElementById('cookie-disclaimer')
    )
    $('.c-timeline').each(function() {
        ReactDOM.render(
            <Timeline   id={$(this).data('currentArticleId')}
                        title={$(this).data('timelineTitle')}
                        nodes={$(this).data('nodes')} />,
            $(this).get(0)
        )
    })
    $('.c-soccer-nationals').each(function() {
        ReactDOM.render(
            <Nationals  id={$(this).data('currentArticleId')}
                        map={$(this).data('map')} 
                        teamData={$(this).data('teamData')} />,
            $(this).get(0)
        )
    })
    $('.c-podcast-episode').each(function() {
        ReactDOM.render(
            <Episode    author = {$(this).data('author')}
                        description = {$(this).data('description')}
                        file = {$(this).data('file')}
                        image = {$(this).data('image')}
                        publishedAt = {$(this).data('published_at')}
                        id = {$(this).data('id')}
                        title = {$(this).data('title')}
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
                        offset: $(this).offset().top + $('#content-wrapper').scrollTop() + index * adSpace/stickyElementLength,
                        dropoff: null,
                        height: $(this).height(),
                        scrollDistance: adSpace/stickyElementLength
                    }
                    stickyElements.push(element)
                })

                // Adjust last sticky element's offset
                if (stickyElements.length > 1) {
                    stickyElements[stickyElements.length - 1].offset = stickyElements[stickyElements.length - 1].offset - stickyElements[stickyElements.length - 1].height/2
                }

                // Sticky Ads
                $('#content-wrapper').scroll(() => {
                    const scrollTop = $('#content-wrapper').scrollTop();
                    stickyAds(scrollTop, stickyElements)
                })
            }
        })
    }

    articleAds()

    const articleList = ReactDOM.render(
        <ArticlesSuggested
          breakpoint={960}
          name={listName}
          currentArticle={firstArticle}
          articles={articleIds}
          userId={userId} />,
          document.getElementById('article-list')
    );

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

ReactDOM.render(
    <Search />,
    document.getElementById('search-form')
);

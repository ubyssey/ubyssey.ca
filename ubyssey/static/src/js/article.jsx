import React from 'react';
import './modules/Youtube';
import ArticleList from './components/ArticleList.jsx';
import Search from './components/Search.jsx';
import Poll from './components/Poll/Poll.jsx';

window.articleHeader = false;

const BOX_HEIGHT = 300
const SKYSCRAPER_HEIGHT = 624

$(function() {
    $('.c-widget-poll').each(function() {
        React.render(
            <Poll id={$(this).data('id')} loaderHTML={$(this).html()} />,
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
    if(articleIds === parseInt(articleIds, 10)){
        articleIds = [articleIds];
    } else {
        articleIds = articleIds.split(',');
    }
    var firstArticle = {
        id: articleId,
        headline: articleHeadline,
        url: articleURL
    };

    function removeSidebar() {
        $('.sidebar').remove()
    }

    function removeSidebarAd() {
        $('.sidebar').children('.o-advertisement--box').removeClass('o-advertisement--box')
    }

    function useSkyscraper() {
        $('.sidebar').children('.o-advertisement--box').addClass('o-advertisement--skyscraper').removeClass('o-advertisement--box')
    }

    function injectSidebarAd(version, number) {
        console.log('add Box_B')
        const id = `div-gpt-ad-1443288719995-${number}-${articleId}`;
        var adString = '<div class="o-advertisement  o-advertisement--box o-advertisement--center"><div class="adslot" id="' + id + '" data-size="box" data-dfp="Box_' + version + '">Text</div></div>';
    
        $('.sidebar').append(adString)
    }

    function injectInlineAds(paragraphs, version, number, index) {
        const id = `div-gpt-ad-1443288719995-${number}-${articleId}`;
        var adString = '<div class="o-article-embed o-article-embed--advertisement"><div class="o-article-embed__advertisement"><div class="o-advertisement o-advertisement--box o-advertisement--center"><div class="adslot" id="' + id + '" data-size="box" data-dfp="Box_' + version + '"></div></div></div></div>';

        if (!$(`#${id}`).length) {
            $(adString).insertAfter(paragraphs.get(index));
        }
    }

    function stickyAds(scrollTop, headerHeight, sidebarOffset, scrollDistance, stickyElements) {
        
        stickyElements.map( (element, index) => {
            const stickyElementHeight = $(element.element).height()

            const dropoff = element.offset + scrollDistance + headerHeight

            const pickup = element.offset - headerHeight

            const articleBottom = $('#content-wrapper').scrollTop() + $('.article-content').offset().top + $('.article-content').outerHeight() - stickyElementHeight
            
            // Dropoff bottom
            if (scrollTop > dropoff || scrollTop > articleBottom) {
                if (!element.dropoff) {
                    element.dropoff = scrollTop - sidebarOffset
                }
                const topOffset = String( element.dropoff + headerHeight ) + 'px'
                // const topOffset = String( element.dropoff ) + 'px'
                element.element.css('position', 'absolute')
                element.element.css('top', topOffset)
            } 
            // Pickup
            else if (scrollTop > pickup) {
                if (!element.pickup) {
                    element.pickup = pickup
                }
                
                const topOffset = String(headerHeight) + 'px'
                element.element.css('position', 'fixed')
                element.element.css('top', topOffset)
                // element.element.css('top', 0)
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
        $(function() {
            const paragraphs = $(`#article-${articleId} .article-content > p`);
            const windowHeight = $(window).height();

            // Mobile
            if ($(window).width() < 960) {
                let insertIndex = Math.floor((Math.random() * 3) + 3);
                $(paragraphs).each(function(index) {
                    if(index === insertIndex) {
                        insertIndex += Math.floor((Math.random() * 3) + 3);
                        
                        if(insertIndex % 2 === 0 ) {
                            injectInlineAds(paragraphs, 'C', 99 + index, index)
                        } else {
                            injectInlineAds(paragraphs, 'D', 100 + index, index)
                        }
                    }
                });
            } 
            // Desktop
            else {
                $( window ).on( "load", function() {
                    // Setup sticky ads
                    const headerHeight = $('.topbar').height() + parseInt($('.sidebar').css('margin-top'), 10)
                    const sidebarOffset = $('.sidebar').offset().top + $('#content-wrapper').scrollTop()
                    const scrollDistance = ($('.article-content').height() - $('.sidebar').height())/2
                    let stickyElements = []

                    console.log($('.article-content').height(), $('.sidebar').height())

                    if ($('.article-content').height() < $('.sidebar').height()) {
                        removeSidebar();
                    }
                    if ($('.article-content').height() > sidebarOffset + SKYSCRAPER_HEIGHT && windowHeight > 800) {
                        useSkyscraper();
                    }
                    if ($('.article-content').height() > sidebarOffset + SKYSCRAPER_HEIGHT + scrollDistance + BOX_HEIGHT + 50 && windowHeight > 800) {
                        injectSidebarAd('B', 200)
                    }

                    $('.sidebar').children('[class*="o-advertisement--"]').addClass('js-sticky')

                    $('.js-sticky').each(function(index) {
                        const element = {
                            element : $(this),
                            offset : $(this).offset().top + $('#content-wrapper').scrollTop() + index*scrollDistance + index*100,
                            pickup : null,
                            dropoff : null,
                        }
                        stickyElements.push(element)
                    })

                    // Sticky Ads
                    $('#content-wrapper').scroll(() => {
                        const scrollTop = $('#content-wrapper').scrollTop();

                        stickyAds(scrollTop, headerHeight, sidebarOffset, scrollDistance, stickyElements)
                    })

                    // Inline Ads
                    let count = 1;
                    $(paragraphs).each(function(index) {
                        if($(paragraphs.get(index)).offset().top + $('.content-wrapper').scrollTop() > count*windowHeight) {
                            count += 1
                            console.log(count)
                            
                            if(count % 2 === 0 ) {
                                injectInlineAds(paragraphs, 'C', 99 + index, index + 1)
                            } else {
                                injectInlineAds(paragraphs, 'D', 100 + index, index + 1)
                            }
                        }
                    });

                })
            }
        })
    }
    
    articleAds()
    
    var articleList = React.render(
        <ArticleList breakpoint={960} name={listName} firstArticle={firstArticle} articles={articleIds} userId={userId} />,
        document.getElementById('article-list')
    );
}

React.render(
    <Search />,
    document.getElementById('search-form')
);
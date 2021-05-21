
var news_fetched = false;
var culture_fetched = false;
var opinion_fetched = false;
var features_fetched = false;
var sports_fetched = false;
var science_fetched = false;

document.domain = 'localhost'


function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie('csrftoken');



window.addEventListener("scroll", function () {
    var news_elementTarget = document.getElementById("news");
    var culture_elementTarget = document.getElementById("culture");
    var opinion_elementTarget = document.getElementById("opinion");
    var features_elementTarget = document.getElementById("features");
    var sports_elementTarget = document.getElementById("sports");
    var science_elementTarget = document.getElementById("science");



    if (window.scrollY > news_elementTarget.offsetTop) {
        console.log('fetching')
        if (!news_fetched) {
            $.ajax({
                url: '',
                type: 'get',
                data: {
                    button_test: $(this).text(),
                    section: 'news',
                    CSRF: csrftoken,
                },
                success: function (response) {
                    create_section_1(response.id, response.sections)
                    news_fetched = true
                }
            })
        }
    }

    if (window.scrollY > culture_elementTarget.offsetTop) {
        if (!culture_fetched) {
            $.ajax({
                url: '',
                type: 'get',
                data: {
                    button_test: $(this).text(),
                    section: 'culture',
                    CSRF: csrftoken,
                },
                success: function (response) {
                    create_section_2(response.id, response.sections)
                    culture_fetched = true
                }
            })
        }
    }

    if (window.scrollY > opinion_elementTarget.offsetTop) {
        if (!opinion_fetched) {
            $.ajax({
                url: '',
                type: 'get',
                data: {
                    button_test: $(this).text(),
                    section: 'opinion',
                    CSRF: csrftoken,
                },
                success: function (response) {
                    create_section_2(response.id, response.sections)
                    opinion_fetched = true
                }
            })
        }
    }

    if (window.scrollY > features_elementTarget.offsetTop) {
        if (!features_fetched) {
            $.ajax({
                url: '',
                type: 'get',
                data: {
                    button_test: $(this).text(),
                    section: 'features',
                    CSRF: csrftoken,
                },
                success: function (response) {
                    create_section_2(response.id, response.sections)
                    features_fetched = true
                }
            })
        }
    }

    if (window.scrollY > sports_elementTarget.offsetTop) {
        if (!sports_fetched) {
            $.ajax({
                url: '',
                type: 'get',
                data: {
                    button_test: $(this).text(),
                    section: 'sports',
                    CSRF: csrftoken,
                },
                success: function (response) {
                    create_section_2(response.id, response.sections)
                    sports_fetched = true
                }
            })
        }
    }

    if (window.scrollY > science_elementTarget.offsetTop) {
        if (!science_fetched) {
            $.ajax({
                url: '',
                type: 'get',
                data: {
                    button_test: $(this).text(),
                    section: 'science',
                    CSRF: csrftoken,
                },
                success: function (response) {
                    create_section_2(response.id, response.sections)
                    science_fetched = true
                }
            })
        }
    }



});





function default_template(padded, hide_image, article) {
    padded = ''
    media = ''

    if (padded) {
        padded = `o-article--padded`
    } else {
        padded = ``
    }


    if (hide_image && (article.featured_image || article.featured_video)) {
        if (article.featured_image !== null) {
            featured = ` <img src="${article.featured_image.image.get_medium_url}" alt=""/> `
        } else {
            featured = ` <img src="http://img.youtube.com/vi/${article.featured_video.video.url}/0.jpg" alt=""/> `
        }

        media = `<div class="o-article__left">
                    <a class="o-article__image" href="${article.get_absolute_url}">
                  
                    </a>
                 </div>`
    }

    return (
        // <span class="o-article__author">By ${article.get_author_url}</span>

        `<article class="o-article o-article--default ${padded}">
                ${media}
        
                <div class="o-article__right">
                <div class="o-article__meta">
                    <h3 class="o-article__headline">
                    <a href="${article.get_absolute_url}">${article.headline}</a>
                    </h3>
                    <div class="o-article__byline">
                   
                    <span> &nbsp;·&nbsp; </span>
                    <span class="o-article__published">${article.published_at}</span>
                    </div>
                </div>
                <p class="o-article__snippet">${article.snippet}</p>
                </div>
        </article>`
    )
}

function featured_template(article, padded) {
    var padded = '';
    var media = '';

    if (padded) {
        padded = `o-article--padded`
    } else {
        padded = ``
    }

    if (article.featured_image || article.featured_image) {
        if (article.featured_image) {
            featured = `<img src="${article.featured_image.image.get_medium_url}" alt=""/>`
        } else {
            featured = ` <img src="http://img.youtube.com/vi/${article.featured_video.video.url | youtube_embed_id}/0.jpg" alt=""/>`
        }

        media = ` <div class="o-article__left">
                    <a class="o-article__image" href="${article.get_absolute_url}">
                    ${featured}
                    </a>
                </div>`
    }

    return (
        `<article class="o-article o-article--featured ${padded}">
                    ${media}
        <div class="o-article__right">
          <div class="o-article__meta">
            <h3 class="o-article__headline">
              <a href="${article.get_absolute_url}">${article.headline}</a>
            </h3>
            <div class="o-article__byline">
              <span class="o-article__author">By ${article.get_author_url}</span>
              <span> &nbsp;·&nbsp; </span>
              <span class="o-article__published">${article.published_at}</span>
            </div>
          </div>
          <p class="o-article__snippet">${article.snippet}</p>
        </div>
      </article>`
    )

}


function column_template(article, padded) {
    var padded = ''


    if (padded) {
        padded = `o-article--padded`
    } else {
        padded = ``
    }

    if (article.featured_image) {
        featured = `<a class="o-article__image" href="${article.get_absolute_url}" style="background-image: url('${article.featured_image.image.get_thumbnail_url}');"></a>`
    } else {
        featured = ``
        //featured = `<a class="o-article__image" href="${article.get_absolute_url}" style="background-image: url('http://img.youtube.com/vi/${article.featured_video.video.url | youtube_embed_id}/0.jpg'); background-size: contain; background-repeat: no-repeat"></a>`
    }

    return (
        `
            <article class="o-article o-article--column ${padded}">
                        <div class="o-article__meta">
                            <div class="o-article__meta__image">
                            ${featured}
                            <h3 class="o-article__headline">
                                <a href="${article.get_absolute_url}">${article.headline}</a>
                            </h3>
                            </div>
                            <div class="o-article__byline">
                            <span class="o-article__author">By ${article.get_author_url}</span>
                            <span> &nbsp;·&nbsp; </span>
                            <span class="o-article__published">${article.published_at}</span>
                            </div>
                        </div>
                        <p class="o-article__snippet">${article.snippe}</p>
            </article>

        `
    )

}



function bullet_template(article) {
    //   <a href=${article.get_absolute_url}">${article.headline}</a>
    return (
        `<article class="o-article o-article--bullet">
        <h3 class="o-article__headline">
        <a>${article.headline}</a>
        </h3>
      </article>`
    )

}


function create_section_1(id, articles) {

    console.log(articles)

    const first = articles[id].first
    const stack = articles[id].stacked
    const bullets = articles[id].bullets

    if (bullets.length !== 0) {
        bullet_li = `<li>${bullet_template(bullets[0])}</li>
                    <li>${bullet_template(bullets[1])}</li>`
    } else {
        bullet_li = ``
    }

    const section_articles = ` <div class="c-homepage__section__left">

                                    ${default_template(true, false, first)}
                                
                        </div>
                        <div class="c-homepage__section__right">

                                    <div class="c-homepage__section__stacked">
                                     ${default_template(true, true, stack[0])}
                                    ${default_template(true, true, stack[1])}
                                    </div>
                                    <ul class="c-homepage__section__bullets">
                                    
                                    ${bullet_li}
                                    </ul>
                        </div>`

    document.getElementById(id).innerHTML += `${section_articles}`
}

function create_section_2(id, articles) {

    console.log(articles[id])
    console.log(articles[id].first)

    const first = articles[id].first
    const rest = articles[id].rest


    const section_articles = `
                                    ${featured_template(first, true)}
                                    <div class="u-flex--tablet">
                                        ${column_template(rest[0], true)}
                                        ${column_template(rest[1], true)}
                                    
                                    </div>
                             `

    document.getElementById(id).innerHTML += `${section_articles}`

}





$(document).ready(function () {

    $(".news-btn").click(function () {
        $.ajax({
            url: '',
            type: 'get',
            data: {
                button_test: $(this).text(),
                section: 'news',
            },
            success: function (response) {
                create_section_1(response.id, response.sections)
            }
        })
    })

    $(".culture-btn").click(function () {
        $.ajax({
            url: '',
            type: 'get',
            data: {
                button_test: $(this).text(),
                section: 'culture',
            },
            success: function (response) {
                create_section_2(response.id, response.sections)
            }
        })

    })

    $(".sports-btn").click(function () {
        $.ajax({
            url: '',
            type: 'get',
            data: {
                button_test: $(this).text(),
                section: 'sports',
            },
            success: function (response) {
                create_section_2(response.id, response.sections)
            }
        })

    })

    $(".opinion-btn").click(function () {
        $.ajax({
            url: '',
            type: 'get',
            data: {
                button_test: $(this).text(),
                section: 'opinion',
            },
            success: function (response) {
                create_section_2(response.id, response.sections)
            }
        })

    })

    $(".features-btn").click(function () {
        $.ajax({
            url: '',
            type: 'get',
            data: {
                button_test: $(this).text(),
                section: 'features'
            },
            success: function (response) {
                create_section_2(response.id, response.sections)
            }
        })

    })

    $(".science-btn").click(function () {
        $.ajax({
            url: '',
            type: 'get',
            data: {
                button_test: $(this).text(),
                section: 'science',
            },
            success: function (response) {
                create_section_2(response.id, response.sections)
            }
        })

    })

})


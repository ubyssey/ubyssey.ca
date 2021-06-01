
var news_fetched = false;
var culture_fetched = false;
var opinion_fetched = false;
var features_fetched = false;
var sports_fetched = false;
var science_fetched = false;

var monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"
];


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


function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}


$.ajaxSetup({
    beforeSend: function (xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});


// Templates


function default_template(padded, hide_image, article, absolute_url, authors) {


    const date = new Date(article.published_at);

    var hours = date.getHours();
    var minutes = date.getMinutes();
    var month = date.getMonth();
    var day = date.getDay();
    var year = date.getFullYear()

    var amPm = (hours < 12) ? "a.m." : "p.m.";

    hours = (hours > 12) ? hours - 12 : hours;

    padded = ''
    media = ''

    if (padded) {
        padded = `o-article--padded`
    } else {
        padded = ``
    }

    if (hide_image === true) {
        media = ``
    } else if (article.featured_image !== null) {
        media = ` <div class="o-article__left">
                     <a class="o-article__image" href="${absolute_url[article.slug]}">
                         <img src="${article.featured_image.image.url_medium}" alt=""/>
                        </a>
                    </div>`
    } else if (article.featured_video !== null) {
        var video_id = article.featured_video.video.url.split('v=')[1];
        var ampersandPosition = video_id.indexOf('&');
        if (ampersandPosition != -1) {
            video_id = video_id.substring(0, ampersandPosition);
        }
        meida = ` <div class="o-article__left">
                     <a class="o-article__image" href="${absolute_url[article.slug]}">
                         <img src="http://img.youtube.com/vi/${video_id}/0.jpg" alt=""/>
                    </a>
                 </div>`
    } else {
        media = ``
    }

    return (

        `<article class="o-article o-article--default ${padded}">
                ${media}
        
                <div class="o-article__right">
                <div class="o-article__meta">
                    <h3 class="o-article__headline">
                    <a href="${absolute_url[article.slug]}">${article.headline}</a>
                    </h3>
                    <div class="o-article__byline">
                    <span class="o-article__author">By ${authors[article.slug]}</span>
                    <span> &nbsp;·&nbsp; </span>
                    <span class="o-article__published"> ${monthNames[month]}  ${day}, ${year}, ${hours}:${minutes} ${amPm}</span>
                    </div>
                </div>
                <p class="o-article__snippet">${article.snippet}</p>
                </div>
        </article>`
    )
}

function featured_template(article, padded, absolute_url, authors) {

    const date = new Date(article.published_at);

    var hours = date.getHours();
    var minutes = date.getMinutes();
    var month = date.getMonth();
    var day = date.getDay();
    var year = date.getFullYear()

    var amPm = (hours < 12) ? "a.m." : "p.m.";

    hours = (hours > 12) ? hours - 12 : hours;



    var padded = '';
    var media = '';

    if (padded) {
        padded = `o-article--padded`
    } else {
        padded = ``
    }


    if (article.featured_image !== null) {
        media = ` <div class="o-article__left">
                        <a class="o-article__image" href="${absolute_url[article.slug]}">
                            <img src="${article.featured_image.image.url_medium}" alt=""/>
                        </a>
                    </div>`

    } else if (article.featured_video !== null) {
        var video_id = article.featured_video.video.url.split('v=')[1];
        var ampersandPosition = video_id.indexOf('&');
        if (ampersandPosition != -1) {
            video_id = video_id.substring(0, ampersandPosition);
        }
        media = ` <div class="o-article__left">
                        <a class="o-article__image" href="${absolute_url[article.slug]}">
                            <img src="http://img.youtube.com/vi/${video_id}/0.jpg" alt=""/>
                        </a>
                    </div>`
    } else {
        media = ``
    }

    return (
        `<article class="o-article o-article--featured ${padded}">
                    ${media}
        <div class="o-article__right">
          <div class="o-article__meta">
            <h3 class="o-article__headline">
              <a href="${absolute_url[article.slug]}">${article.headline}</a>
            </h3>
            <div class="o-article__byline">
              <span class="o-article__author">By ${authors[article.slug]}</span>
              <span> &nbsp;·&nbsp; </span>
              <span class="o-article__published"> ${monthNames[month]}  ${day}, ${year}, ${hours}:${minutes} ${amPm}</span>
            </div>
          </div>
          <p class="o-article__snippet">${article.snippet}</p>
        </div>
      </article>`
    )

}


function column_template(article, padded, absolute_url, authors) {

    const date = new Date(article.published_at);

    var hours = date.getHours();
    var minutes = date.getMinutes();
    var month = date.getMonth();
    var day = date.getDay();
    var year = date.getFullYear()

    var amPm = (hours < 12) ? "a.m." : "p.m.";

    hours = (hours > 12) ? hours - 12 : hours;


    var padded = ''


    if (padded) {
        padded = `o-article--padded`
    } else {
        padded = ``
    }

    if (article.featured_image !== null) {
        featured = `<a class="o-article__image" href="${absolute_url[article.slug]}" style="background-image: url('${article.featured_image.image.url_thumb}');"></a>`
    } else if (article.featured_video !== null) {
        var video_id = article.featured_video.video.url.split('v=')[1];
        var ampersandPosition = video_id.indexOf('&');
        if (ampersandPosition != -1) {
            video_id = video_id.substring(0, ampersandPosition);
        }

        featured = `<a class="o-article__image" href="${absolute_url[article.slug]}" style="background-image: url('http://img.youtube.com/vi/${video_id}/0.jpg'); background-size: contain; background-repeat: no-repeat"></a>`
    } else {
        featured = ``
    }

    return (
        `
            <article class="o-article o-article--column ${padded}">
                        <div class="o-article__meta">
                            <div class="o-article__meta__image">
                            ${featured}
                            <h3 class="o-article__headline">
                                <a href="${absolute_url[article.slug]}">${article.headline}</a>
                            </h3>
                            </div>
                            <div class="o-article__byline">
                            <span class="o-article__author"> By ${authors[article.slug]}  </span>
                            <span> &nbsp;·&nbsp; </span>
                            <span class="o-article__published"> ${monthNames[month]}  ${day}, ${year}, ${hours}:${minutes} ${amPm}</span>
                            </div>
                        </div>
                        <p class="o-article__snippet">${article.snippet}</p>
            </article>

        `
    )

}

function blog_column_template(article, absolute_url) {

    if (article.featured_image !== null) {
        featured = `<a class="o-article__image" href="${absolute_url[article.slug]}" style="background-image: url('${article.featured_image.image.url_thumb}');"></a>`
    } else if (article.featured_video !== null) {
        var video_id = article.featured_video.video.url.split('v=')[1];
        var ampersandPosition = video_id.indexOf('&');
        if (ampersandPosition != -1) {
            video_id = video_id.substring(0, ampersandPosition);
        }

        featured = `<a class="o-article__image" href="${absolute_url[article.slug]}" style="background-image: url('http://img.youtube.com/vi/${video_id}/0.jpg'); background-size: contain; background-repeat: no-repeat"></a>`
    } else {
        featured = ``
    }

    return (

        `<article class="o-article o-article--column o-article--padded">
        <div class="o-article__meta">
          <div class="o-article__meta__image">
           ${featured}
            <h3 class="o-article__headline">
              <a href="${absolute_url[article.slug]}">${article.headline}</a>
            </h3>
          </div>
        </div>
      </article>`
    )





}



function bullet_template(article, absolute_url) {

    return (
        `<article class="o-article o-article--bullet">
        <h3 class="o-article__headline">
          <a href="${absolute_url[article.slug]}">${article.headline}</a>
        </h3>
      </article>`
    )

}


//creating sections 

function create_blogsection(articles, absolute_url) {

    var blogs = ''
    var i;


    for (i = 0; i < articles.length; i++) {
        blogs = blogs + blog_column_template(articles[i], absolute_url)
    }

    const inserting_html = ` <h2 class="block-title">From the blog</h2>
                                <ul class="article-list">
                                   ${blogs}
                                </ul>`

    document.getElementById('blog').innerHTML += inserting_html

}


function create_section_1(id, articles, absolute_url, authors) {

    const first = articles[id].first
    const stack = articles[id].stacked
    const bullets = articles[id].bullets

    if (bullets.length !== 0) {
        bullet_li = `<li>${bullet_template(bullets[0], absolute_url)}</li>
                    <li>${bullet_template(bullets[1], absolute_url)}</li>`
    } else {
        bullet_li = ``
    }

    <section class="{{ section|safe }} homepage row" >
        <h1 class="section"> News  <button class="news-btn"> News Ajax </button> </h1>


        <section class="c-homepage__section c-homepage__section--1" id="news">


        </section>
    </section>

    const section_articles = ` 
    
                <section class="{{ section|safe }} homepage row" >

                    <h1 class="section"> News </h1>

                    <section class="c-homepage__section c-homepage__section--1" id="news"> 
    
                                <div class="c-homepage__section__left">

                                            ${default_template(true, false, first, absolute_url, authors)}
                                        
                                </div>
                                <div class="c-homepage__section__right">

                                            <div class="c-homepage__section__stacked">
                                            ${default_template(true, true, stack[0], absolute_url, authors)}
                                            ${default_template(true, true, stack[1], absolute_url, authors)}
                                            </div>
                                            <ul class="c-homepage__section__bullets">
                                            
                                            ${bullet_li}
                                            </ul>
                                </div>
                    </section>
                
                </section>`

    document.getElementById('section_container').innerHTML += `${section_articles}`
}

function create_section_2(id, articles, absolute_url, authors) {


    const first = articles[id].first
    const rest = articles[id].rest



    const section_articles = `

                    <section class="{{ section|safe }} homepage row" >

                        <h1 class="section"> ${id}  </h1>

                            <section class="c-homepage__section c-homepage__section--2" id="culture"> 

                                                            ${featured_template(first, true, absolute_url, authors)}
                                                            <div class="u-flex--tablet">
                                                                ${column_template(rest[0], true, absolute_url, authors)}
                                                                ${column_template(rest[1], true, absolute_url, authors)}
                                                            
                                                            </div>
                            </section>
                    </section>
                `

    document.getElementById('section_container').innerHTML = document.getElementById('section_container').innerHTML + `${section_articles}`


}

function load_news(scrollHandler) {

    $.ajax({
        url: '/ajax/home',
        type: 'get',
        data: {
            section: 'news',
        },
        beforeSend: function () {
            $('.loader').show();
        },
        complete: function () {
            $('.loader').hide();
        },
        success: function (response) {
            console.log('success')
            create_section_1(response.id, response.sections, response.absolute_url, response.authors);
            news_fetched = true
            $(window).scroll(scrollHandler);
        }
    })


}

function load_others(section, scrollHandler) {

    $.ajax({
        url: '/ajax/home',
        type: 'get',
        data: {
            section: section,
        },
        beforeSend: function () {
            $('.loader').show();
        },
        complete: function () {
            $('.loader').hide();
        },
        success: function (response) {
            console.log('success')
            create_section_2(response.id, response.sections, response.absolute_url, response.authors);
            setTrue(section)
            $(window).scroll(scrollHandler);
        }
    })



}

function load_prints() {
    prints = ` <h2 class="block-title">Check Out Our Digital Print Issue</h2>
    <div class='sidebar-issue'>
      <h5 class="headline" id='issue-photo'><a class='issue' id ='issue1' href="https://issuu.com/ubyssey/docs/the_ubyssey_september_29">September 29, 2020<img src="https://image.isu.pub/201001002709-c77a1db2115eeeab32729a767143d27e/jpg/page_1_thumb_large.jpg"></a></h5>
      <h5 class="headline"><a class='issue' id ='issue2' href="https://issuu.com/ubyssey/docs/the_ubyssey_aug_25">August 25, 2020</a></h5>
      <h5 class="headline"><a class='issue' id ='issue3' href="https://issuu.com/ubyssey/docs/the_ubyssey_the_guide_2020">Guide to UBC 2020/21</a></h5>
      <h5 class="headline"><a class='issue' id ='issue4' href="https://issuu.com/ubyssey/docs/the_ubyssey_july_28">July 28, 2020</a></h5>
    </div>`

    document.getElementById('sidebar-block').innerHTML = prints


}

function load_blog() {

    $.ajax({
        url: '/ajax/home',
        type: 'get',
        data: {
            section: 'blog',
        },
        success: function (response) {
            create_blogsection(response.blogs, response.absolute_url)
        }
    })

}

function setTrue(section) {

    switch (section) {
        case 'culture':
            culture_fetched = true
            break;
        case 'opinion':
            opinion_fetched = true
            break;
        case 'features':
            features_fetched = true
            break;
        case 'sports':
            sports_fetched = true
            break;
        case 'science':
            science_featched = true
            break;
    }

}

$(window).scroll(function scrollHandler() {
    if ($(window).scrollTop() + $(window).height() == $(document).height()) {
        if (!news_fetched) {
            $(window).off("scroll", scrollHandler);
            load_news(scrollHandler)
            load_prints()
            load_blog()
        }

        if (news_fetched && !culture_fetched) {
            $(window).off("scroll", scrollHandler);
            load_others('culture', scrollHandler);
        }

        if (culture_fetched && !sports_fetched) {
            $(window).off("scroll", scrollHandler);
            load_others('sports', scrollHandler)

        }

        if (sports_fetched && !opinion_fetched) {
            $(window).off("scroll", scrollHandler);
            load_others('opinion', scrollHandler)

        }

        if (opinion_fetched && !features_fetched) {
            $(window).off("scroll", scrollHandler);
            load_others('features', scrollHandler)
        }

        if (features_fetched && !science_fetched) {
            alert('bottom')
        }
    }
});











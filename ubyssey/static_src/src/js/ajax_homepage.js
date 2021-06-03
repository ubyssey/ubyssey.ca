
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

//The featured tempalate
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

//The column template 
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

//creating sections using the section template 

function create_section(id, articles, absolute_url, authors) {


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

//a GET request based on the 'section'
function load_sections(section, scrollHandler) {

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
            create_section(response.id, response.sections, response.absolute_url, response.authors);
            setTrue(section)
            $(window).scroll(scrollHandler);
        }
    })



}


//setting the fetch to true after ajax call is successful 
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
    //An ajax call will be sent when the user reaches the bottom of the window
    if ($(window).scrollTop() + $(window).height() == $(document).height()) {

        //fetch the culture first
        if (!culture_fetched) {
            $(window).off("scroll", scrollHandler);
            load_sections('culture', scrollHandler);
        }

        //if the culture section is fetched then fetch the sports section
        if (culture_fetched && !sports_fetched) {
            $(window).off("scroll", scrollHandler);
            load_sections('sports', scrollHandler)

        }

        //if the sports section is fetched then fetch the opinion section
        if (sports_fetched && !opinion_fetched) {
            $(window).off("scroll", scrollHandler);
            load_sections('opinion', scrollHandler)

        }

        //if the opinion section is fetched then fetch the features section 
        if (opinion_fetched && !features_fetched) {
            $(window).off("scroll", scrollHandler);
            load_sections('features', scrollHandler)
        }

        //if the features section is fetched then fetch the science section
        if (features_fetched && !science_fetched) {
            $(window).off("scroll", scrollHandler);
            load_sections('science', scrollHandler)
        }
    }
});











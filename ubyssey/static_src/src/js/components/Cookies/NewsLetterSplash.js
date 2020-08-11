import Cookies from 'js-cookie'

function getCookieName() {
    return 'ubyssey_site_visit'
}

function getCookie(field) {
    let cookie = Cookies.get(getCookieName())
    if (typeof cookie === 'string' && cookie !== '') {
        cookie = JSON.parse(cookie)
        if (field) {
        return cookie[field]
        }
        return cookie
    }
return cookie
}

function setCookie(visitCount, enableAdvertisementSplash, enableSubscribeSplash) {
    Cookies.set(
        getCookieName(),
        {'visitCount': visitCount, 'enableAdvertisementSplash': enableAdvertisementSplash, 'enableSubscribeSplash': enableSubscribeSplash},
        { expires: 90, path: '/' }
    )
}
function hideSubscribeSplash(){
    document.getElementById('subscribe-splash').style.display = 'none';
}

function disableSubscribeSplash() {
    const visitCount = getCookie('visitCount');
    const enableAdvertisementSplash = getCookie('enableAdvertisementSplash');
    setCookie(visitCount, enableAdvertisementSplash, false);
    hideSubscribeSplash();
}

function showSubscribeSplash() {
    // hardcoding whoops lol
    $('#subscribe-link').trigger("click");
}

const visitCount = getCookie('visitCount')
const enableSubscribeSplash = getCookie('enableSubscribeSplash')

// cookies are disabled or visited more than 3 times without disabling splash
export function showNewsletter() {
     //document.getElementById('subscriber_email_field').removeAttr("required");
    //  document.getElementById('already-sub-button').onclick = function(){disableSubscribeSplash()};
    //  document.getElementById('subscribe-close-message').onclick = function(){hideSubscribeSplash()};
    if (!navigator.cookieEnabled || enableSubscribeSplash === undefined || (visitCount%1 == 0 && enableSubscribeSplash)) {
        // $('#subscribe-splash').modalForm({
        //     formURL: "{% url 'subscribe' %}"
        // });
        showSubscribeSplash();
    }
}
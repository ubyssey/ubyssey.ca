import * as mp from './modules/Mixpanel'
import upcomingEvents from './widgets/upcoming-events'
import { initializeUI } from './notifications'

if ('serviceWorker' in navigator && 'PushManager' in window) {
  navigator.serviceWorker
    .register('/service-worker.js')
    .then(function(swReg) {
      $('#beta-test-push-notifications').click(() => {
        const delay_1 = 500
        const prompt = 'beta-prompt'
        let promptMessage = ''
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              initializeUI(swReg)
            }
          })
        } else if (Notification.permission === 'granted') {
          promptMessage = 'You are already subscribed!'
          initializeUI(swReg)
        } else if (Notification.permission === 'denied') {
          promptMessage = `It lookes like you are currently blocking notifications from ubyssey.ca.
          If you would like to allow notifications please change your settings. For more information, please visit
          <a href='https://support.google.com/chrome/answer/3220216?co=GENIE.Platform%3DDesktop&hl=en'> here </a>`
          initializeUI(swReg)
        }
        if (promptMessage !== '') {
          $('body').append("<div class='beta-prompt'><div class='beta-prompt-internal'></div></div>")
          $('.beta-prompt-internal').html(promptMessage)

          setTimeout(() => {
            $('.beta-prompt').remove()
          }, 3000)
        }
      })
    })
    .catch(function(error) {
      console.error('Service Worker Error', error)
    })
} else {
  console.warn('Push messaging is not supported')
}

function disableScroll($document) {
  $document.on('touchmove', function(e) {
    e.preventDefault()
  })
  $('body').addClass('u-no-scroll')
}

function enableScroll($document) {
  $document.off('touchmove')
  $('body').removeClass('u-no-scroll')
}

function embedMargins() {
  const marginLeft = $('.article-content > p:first-child').css('marginLeft')
  const marginRight = $('.article-content > p:first-child').css('marginRight')
  $('.image-attachment.left').css('marginLeft', marginLeft)
  $('.image-attachment.right').css('marginRight', marginRight)
}

;(function() {
  var $searchform = $('#search-form'),
    $document = $(document)

  $('.dropdown > a').click(function(e) {
    e.preventDefault()
    var dropdown = $(this)
      .parent()
      .find('.list')
    if (dropdown.is(':visible')) {
      dropdown.hide()
    } else {
      dropdown.show()
    }
    return false
  })

  $document.on('click', function(e) {
    $('.dropdown .list').hide()
    $('.js-dropdown-list').hide()
    enableScroll($document)
  })

  var DROPDOWN_FADE_TIME = 100

  $('.js-dropdown > a').click(function(e) {
    e.preventDefault()
    var dropdown = $(this)
      .parent()
      .find('.js-dropdown-list')
    if (dropdown.is(':visible')) {
      dropdown.fadeOut(DROPDOWN_FADE_TIME)
      enableScroll($document)
    } else {
      dropdown.fadeIn(DROPDOWN_FADE_TIME)
      if ($(this).hasClass('js-disable-scroll')) {
        disableScroll($document)
      }
    }
    return false
  })

  $('.js-dropdown-list a').click(function(e) {
    e.stopPropagation()
  })

  $('.js-dropdown-container').click(function(e) {
    e.preventDefault()
    var dropdown = $(this).parent()
    dropdown.fadeOut(DROPDOWN_FADE_TIME)
    enableScroll($document)
    return false
  })

  $('a.menu').click(function(e) {
    e.preventDefault()
    if ($('nav.mobile').is(':visible')) {
      $('nav.mobile').hide()
      $(this).removeClass('active')
    } else {
      if ($searchform.is(':visible')) {
        $searchform.hide()
        $('a.search').removeClass('active')
      }
      $('nav.mobile').show()
      $(this).addClass('active')
    }
  })

  $document.on('keyup', function(e) {
    var ESCAPE = 27
    if (e.keyCode == ESCAPE) {
      $searchform.is(':visible') && $searchform.hide()
    }
  })

  $(document).click(function() {
    $searchform.hide()
  })

  $(document).on('click', '#search-form > .u-container', function(e) {
    e.stopPropagation()
  })

  $(document).on('click', 'a.search', function(e) {
    e.preventDefault()
    if ($searchform.is(':visible')) {
      $searchform.hide()
      $(this).removeClass('active')
    } else {
      if ($('nav.mobile').is(':visible')) {
        $('nav.mobile').hide()
        $('a.menu').removeClass('active')
      }
      $searchform.show()
      $('#search-bar').focus()
      $(this).addClass('active')
    }
    e.stopPropagation()
  })

  $document.on('click', 'a.facebook', function(e) {
    e.preventDefault()
    FB.ui(
      {
        method: 'share_open_graph',
        action_type: 'og.likes',
        action_properties: JSON.stringify({
          object: $(this).data('url')
        })
      },
      function(response) {}
    )
  })

  $document.on('click', 'a.twitter', function(e) {
    e.preventDefault()
    window.open(
      'http://twitter.com/share?url=' + $(this).data('url') + '&text=' + $(this).data('title') + '&',
      'twitterwindow',
      'height=450, width=550, top=' +
        ($(window).height() / 2 - 225) +
        ', left=' +
        ($(window).width() / 2 - 225) +
        ', toolbar=0, location=0, menubar=0, directories=0, scrollbars=0'
    )
  })

  $document.on('touchstart', function() {})

  var $article = $('.js-article')

  if ($article.length) {
    mp.pageView('article', $article, 1)
  } else {
    mp.pageView()
  }

  $document.ready(embedMargins())

  // register widgets
  upcomingEvents()
})()

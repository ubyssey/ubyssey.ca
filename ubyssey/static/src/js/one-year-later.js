function updateHeader() {
  const scrollTop = $(window).scrollTop()

  let element = $('.js-sticky')
  const elementHeight = element.height(),
    elementOffset = $(window).height() - elementHeight,
    parentOffset = element.parent().offset().top,
    parentHeight = element.parent().height()

  if (parentHeight <= elementHeight) {
    return
  }

  const hasClass = element.hasClass('js-sticky--fixed'),
    shouldStick = scrollTop > elementOffset,
    shouldFreeze = scrollTop + elementOffset + elementHeight >= parentOffset + parentHeight

  if (shouldStick) {
    if (!hasClass) {
      element.removeClass('js-sticky--frozen')
      element.addClass('js-sticky--fixed')
      element.css('top', element.data('offset') + 'px')
    }
  } else if (hasClass) {
    element.removeClass('js-sticky--fixed')
  }
}

function updateVideo() {
  const header = $('.oyl-header__container')
  if (header.width() / header.height() < 1.77) {
    $('#header-video').addClass('vertical')
  } else {
    $('#header-video').removeClass('vertical')
  }
}

$(function() {
  updateVideo()
  updateHeader()

  var vid = document.getElementById('header-video')

  vid.ontimeupdate = function() {
    const timeRemaining = vid.duration - vid.currentTime

    if (timeRemaining < 5) {
      $('.oyl-header__shadow').addClass('is-visible')
    }

    if (timeRemaining < 3) {
      $('.oyl-article__header').addClass('is-visible')
    }
  }

  $(window).scroll(updateHeader)
  $(window).resize(updateVideo)
})

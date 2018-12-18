var AUTOPLAY_SPEED = 5000 // ms
var FADE_OUT_SPEED = 100 // ms
var FADE_IN_SPEED = 600 // ms

function registerWidget() {
  $('.js-scrollbar').mCustomScrollbar({
    theme: 'minimal-dark',
    scrollInertia: 100
  })

  $('.js-carousel').each(function() {
    var carousel = $(this)
    carousel.currentSlide = 0
    carousel.slides = []

    var containerHeight = 0

    carousel.find('.js-carousel__item').each(function(i) {
      var item = $(this)
      item.css('display', 'block')
      item.slideIndex = i
      carousel.slides.push(item)

      containerHeight = Math.max(containerHeight, item.outerHeight())
      var width = item.outerWidth()
      item.css('position', 'absolute')
      item.css('height', containerHeight)
      item.css('width', width)

      if (i) {
        item.css('display', 'none')
      }
    })

    carousel.find('.js-carousel-inner').css('height', containerHeight)

    var numSlides = carousel.slides.length

    if (numSlides > 1) {
      carousel.setSlide = function(n) {
        carousel.currentSlide = n

        if (carousel.currentSlide >= numSlides) {
          carousel.currentSlide = 0
        } else if (carousel.currentSlide < 0) {
          carousel.currentSlide = numSlides - 1
        }

        var slideToActivate = carousel.slides[carousel.currentSlide]

        slideToActivate.css('opacity', 0)
        slideToActivate.css('display', 'block')
        slideToActivate.animate({ opacity: 1 }, FADE_IN_SPEED, 'linear')

        $.each(carousel.slides, function(i, slide) {
          if (slide != slideToActivate && slide.is(':visible')) {
            slide.animate({ opacity: 0 }, FADE_OUT_SPEED, 'linear', function() {
              slide.css('display', 'none')
            })
          }
        })

        $.each(carouselButtons, function(i, button) {
          button.removeClass('carousel-button--active')
          if (carousel.currentSlide == i) {
            button.addClass('carousel-button--active')
          }
        })
      }

      var startAutoplay = function() {
        carousel.interval = setInterval(function() {
          carousel.setSlide(carousel.currentSlide + 1)
        }, AUTOPLAY_SPEED)
      }

      var carouselButtons = []
      var buttonRow = $('<div>', { class: 'carousel-button-row' })
      carousel.append(buttonRow)
      for (var j = 0; j < carousel.slides.length; j++) {
        var button = $('<div>', {
          class: 'carousel-button' + (!j ? ' carousel-button--active' : ''),
          'data-index': j
        })

        button.click(function() {
          var i = $(this).data('index')
          carousel.setSlide(i)
          clearInterval(carousel.interval)

          // restart autoplay after some time
          carousel.interval = setTimeout(startAutoplay, AUTOPLAY_SPEED / 2)
        })

        buttonRow.append(button)
        carouselButtons.push(button)
      }

      startAutoplay()
    }
  })
}

module.exports = registerWidget

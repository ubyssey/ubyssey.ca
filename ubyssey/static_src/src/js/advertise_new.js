// Scripts for the /advertise/ page
// Bundled as 'a.js' to prevent AdBlocker blocking.

$(function() {
  // Navigation links smooth scrolling
  $('a[href*=\\#]').on('click', function(e) {
    $('html,body').animate({ scrollTop: $(this.hash).offset().top }, 500);
  });

  $('.o-placements--web .o-placements__placement').click(function() {
    $('.o-placements--web .o-placements__placement').removeClass('o-placements__placement--active');
    $(this).addClass('o-placements__placement--active');
    $('.o-placements--web .o-placements__demo__inner__right img').animate({
      left: $(this).data('horizontaloffset'),
    }, 250, function() {
      //animation complete
    }
    )
    $('.o-placements--web .o-placements__demo__inner__right img').css('top', $(this).data('offset'));
    $('.o-placements--web .o-placements__demo__inner__left img').css('top', $(this).data('offset'));
  });

  $('.o-placements--web .o-placements__platform--mode').click(function() {
    $('.o-placements--web .o-placements__platform--mode').removeClass('o-placements__platforms--active');
    $(this).addClass('o-placements__platforms--active');
    if ($(this).data('platform') == 'desktop') {
      $('.o-placements__demo__desktop').removeClass('o-hidden');
      $('.o-placements__demo__mobile').addClass('o-hidden');
      $('.o-placements__placement--demo--sidebar').removeClass('o-unavailable');
    }
    else {
      $('.o-placements__demo__desktop').addClass('o-hidden')
      $('.o-placements__demo__mobile').removeClass('o-hidden')
      $('.o-placements__placement--demo--sidebar').addClass('o-unavailable')
    }
  });

  $('.o-placements--print .o-placements__placement--demo').click(function() {
    $('.o-placements--print .o-placements__placement').removeClass('o-placements__placement--active');
    $(this).addClass('o-placements__placement--active');
    $('.o-placements--print .o-placements__demo').attr('data-demo', $(this).data('demo'));
  });

  $('.o-placements--guide .o-placements__placement--demo').click(function() {
    $('.o-placements--guide .o-placements__placement').removeClass('o-placements__placement--active');
    $(this).addClass('o-placements__placement--active');
    $('.o-placements--guide .o-placements__demo').attr('data-demo', $(this).data('demo'));
  });

  // Open modal
  $('.c-production-schedule__view').click(function() {
    $('.c-production-schedule__modal').show();
  })

  // Close modal
  $('.c-production-schedule__modal__close').click(function() {
    $('.c-production-schedule__modal').hide();
  });

  $('.c-production-schedule__modal').click(function() {
    $('.c-production-schedule__modal').hide();
  });

  $('.c-production-schedule__modal img').click(function(e) {
    e.stopPropagation()
  });

  $('.c-web-slider__point > div').click(function(e) {
    var offset = $(this).offset().left - $('.c-web-slider').offset().left;
    var content = $(this).data('content');
    var cost = $(this).data('cost');
    slideTo(offset, content, cost);
  });

  function slideTo(offset, content, cost) {
    var tooltipWidth = $('.c-web-slider__tooltip').outerWidth();
    var maxOffset = $('.c-web-slider').width() - tooltipWidth;

    offset = Math.max(0, offset - 25);

    $('.c-web-slider__tooltip').css('margin-left', Math.min(offset, maxOffset));

    var offsetPercent = 8;

    if (offset > maxOffset) {
      var offsetDif = offset - maxOffset + 35;
      offsetPercent = offsetDif / tooltipWidth * 100;
      offsetPercent = Math.min(92, offsetPercent);
    }

    $('.c-web-slider__tooltip__arrow').css('left', offsetPercent + '%');
    $('.c-web-slider__tooltip__content').html(content);
    $('.c-web-slider__tooltip__cost').text(cost);
  }
});

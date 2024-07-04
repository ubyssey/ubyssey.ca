// Scripts for the /advertise/ page
// Bundled as 'a_new.js' to prevent AdBlocker blocking.

var cart = {};

$(function() {
  // Navigation links smooth scrolling
  $('.nav-link').on('click', function(e) {
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
    console.log($(this).data('offsetdesktop'));
    $('.o-placements--web .o-placements__demo__desktop').css('top', $(this).data('offsetdesktop'));
    $('.o-placements--web .o-placements__demo__mobile').css('top', $(this).data('offsetmobile'));
  });

  $('.o-placements--web .o-placements__platform--mode').click(function() {
    $('.o-placements--web .o-placements__platform--mode').removeClass('o-placements__platforms--active');
    $(this).addClass('o-placements__platforms--active');
    if ($(this).data('platform') == 'desktop') {
      $('.o-placements--web .o-placements__demo').removeClass('o-placements__demo--mobile');
      $('.o-placements--web .o-placements__demo__desktop').removeClass('o-hidden');
      $('.o-placements--web .o-placements__demo__mobile').addClass('o-hidden');
      $('.o-placements--web .o-placements__placement--demo--no_mobile').removeClass('o-unavailable');
    }
    else {
      $('.o-placements--web .o-placements__demo').addClass('o-placements__demo--mobile');
      $('.o-placements--web .o-placements__demo__desktop').addClass('o-hidden')
      $('.o-placements--web .o-placements__demo__mobile').removeClass('o-hidden')
      $('.o-placements--web .o-placements__placement--demo--no_mobile').addClass('o-unavailable')
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

  $(document).on('click', '.delete-cart-item', function (e) {
    e.preventDefault();
    delete cart[this.parentElement.id];
    document.getElementById(this.parentElement.id + "-selector").classList.remove("selected");
    this.parentElement.remove();
    updateCart();
  });

  $(document).on('click', '.offer-link', function (e) {
    e.preventDefault();
    this.parentElement.classList.toggle("selected");
    if(this.parentElement.classList.contains("selected")) {
      var text = String(this.parentElement.getElementsByClassName("offer-number")[0].value) + "x " + this.parentElement.getAttribute("offer");

      cart[this.parentElement.getAttribute("offerId")] = text;
      console.log(cart);
      var cartItem = document.createElement("div");
      cartItem.classList.add("cart-item");
      cartItem.id = this.parentElement.getAttribute("offerId");
      cartItem.innerHTML = "<a href='#' class='delete-cart-item'><i class='fa fa-close'></i></a><span>" + text + "</span>";
      document.getElementById("cart-container").appendChild(cartItem);
    } else {
      document.getElementById(this.parentElement.getAttribute("offerId")).remove();
      delete cart[this.parentElement.getAttribute("offerId")];
    }
    updateCart();
  });

  $(document).on('change', '.offer-number', function(e) {
    var text = String(this.value) + "x " + this.parentElement.getAttribute("offer");
    cart[this.parentElement.getAttribute("offerId")] = text;
    document.getElementById(this.parentElement.getAttribute("offerId")).getElementsByTagName("span")[0].innerHTML = text;
    updateCart();
  });

  function updateCart() {
    document.getElementById("cart").value = Object.values(cart).join("\n");
    if(Object.keys(cart).length == 0) {
      document.getElementById("cart-header-span").innerHTML = "(no items)";
    } else {
      document.getElementById("cart-header-span").innerHTML = "(" + String(Object.keys(cart).length) + " items)";
    }
  }

  document.body.onscroll = function() {
    var button = document.getElementById("to-bottom");
    if(!button.classList.contains("hidden") && 
      document.documentElement.scrollTop >= document.getElementById("contact").offsetTop - document.getElementById("contact").offsetHeight) {
      button.classList.add("hidden");
      console.log("hide");
    } else if (button.classList.contains("hidden") && 
    document.documentElement.scrollTop < document.getElementById("contact").offsetTop - document.getElementById("contact").offsetHeight) {
      button.classList.remove("hidden");
      console.log("show");
    }
  };
});

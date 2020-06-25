$('#c-nav-home').hover(function(e) {
  e.stopPropagation();
  $('.c-home-more').finish();
  $('.c-home-more').slideToggle(300);
}, (function(e) {
  e.stopPropagation();
  $('.c-home-more').finish();
  $('.c-home-more').fadeOut(300);
})
);
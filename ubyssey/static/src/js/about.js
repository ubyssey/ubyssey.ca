// this code triggers animations when the elements are scrolled into view


	var animateHTML = function() {
	  var windowHeight;
	  function init() {
	  	//slide right and slide left elements elements
	    var elems = $('.slide-right') + $('.slide-left');

	    windowHeight = $(window).innerHeight;
	    addEventHandlers();
	    checkPosition();
	  }
	  function addEventHandlers() {
	  	$(window).scroll(checkPosition);
	  	$(window).resize(init);
	    // window.addEventListener('scroll', checkPosition);
	    // window.addEventListener('resize', init);
	  }
	  function checkPosition() {
	    for (var i = 0; i < elems.length; i++) {
	      var positionFromTop = elems[i].getBoundingClientRect().top;
	      if (positionFromTop - windowHeight <= 0) {
	        elems[i].addClass('slide-anim');
	      }
	    }
	  }
	  return {
	    init: init
	  };
	};
	animateHTML().init();
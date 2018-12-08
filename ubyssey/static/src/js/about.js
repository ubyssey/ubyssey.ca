// this code triggers animations when the elements are scrolled into view


  var animateHTML = function() {
    var elemsL;
    var elemsR;
    var windowHeight;
    function init() {
      //slide right and slide left elements elements
      elemsL = document.querySelectorAll('.slide-left');
      elemsR = document.querySelectorAll('.slide-right');

      windowHeight = window.innerHeight;
      addEventHandlers();
      checkPosition();
    }
    function addEventHandlers() {
      window.addEventListener('scroll', checkPosition);
      window.addEventListener('resize', init);
    }
    function checkPosition() {
      // function to check the position of selected elements
      for (var i = 0; i < elemsL.length; i++) {
        var positionFromTop = elemsL[i].getBoundingClientRect().top;
        if (positionFromTop - windowHeight <= 0) {
          elemsL[i].classList.add('slide-anim');
        }
      }
      for (var j = 0; j < elemsR.length; j++) {
        var positionFromTop = elemsR[j].getBoundingClientRect().top;
        if (positionFromTop - windowHeight <= -100) {
          elemsR[j].classList.add('slide-anim');
        }
      }
    }
    return {
      init: init
    };
  };

  animateHTML().init();
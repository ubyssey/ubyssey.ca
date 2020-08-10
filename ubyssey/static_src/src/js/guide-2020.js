const colors = {
  colorHome: "#0073A9",
  colorAdulting: "#59A3AC",
  colorAcademics: "#FBCC80",
  colorSDP: "#E2BEB0",
  colorVancouver: "#EA8392",
  colorUBC: "#002145"
}


function dropDownHeader(dropDownParentName, dropDownName) {
  $(dropDownParentName).hover(function(e) {
    e.stopPropagation();
    $(dropDownName).finish();
    $(dropDownName).slideToggle(300);
    }, (function(e) {
      e.stopPropagation();
      $(dropDownName).finish();
      $(dropDownName).fadeOut(300);
    })
  );
}

function checkFooter() {
  if(window.screen.width < 500) {
    if (window.location.href.indexOf("academics") > -1) {
      if(document.getElementById("footer-academics") != null) {
        document.getElementById("footer-academics").style.display = 'block';
      }
     } else if (window.location.href.indexOf("adulting") > -1) {
      if(document.getElementById("footer-adulting") != null) {
        document.getElementById("footer-adulting").style.display = 'block';
      }
     } else if (window.location.href.indexOf("sdp") > -1) {
       if(document.getElementById("footer-sdp") != null) {
        document.getElementById("footer-sdp").style.display = 'block';
       }
     } else if (window.location.href.indexOf("vancouver") > -1) {
       if(document.getElementById("footer-vancouver") != null) {
        document.getElementById("footer-vancouver").style.display = 'block';
       }
     } else if (window.location.href.indexOf("ubc") > -1) {
      if(document.getElementById("footer-ubc") != null) {
        document.getElementById("footer-ubc").style.display = 'block';
      }
     } else {
       if(document.getElementById("footer-academics") != null) {
        document.getElementById("footer-academics").style.display = 'block';
       }
       if(document.getElementById("footer-adulting") != null) {
        document.getElementById("footer-adulting").style.display = 'block';
       }
       if(document.getElementById("footer-ubc") != null) {
        document.getElementById("footer-ubc").style.display = 'block';
       }
       if(document.getElementById("footer-vancouver") != null) {
        document.getElementById("footer-vancouver").style.display = 'block';
       }
       if(document.getElementById("footer-sdp") != null) {
        document.getElementById("footer-sdp").style.display = 'block';
       }
     }
  }
}

$(document).ready(function(){
  checkFooter();
  dropDownHeader('#c-nav-home-mobile', '.c-home-more');
  dropDownHeader('#c-nav-home-tablet', '.c-home-more');
  dropDownHeader('.c-nav-current', '#c-section-more--current');
  dropDownHeader('#c-nav-section--academic', '#c-section-more--academic');
  dropDownHeader('#c-nav-section--ubc', '#c-section-more--ubc');
  dropDownHeader('#c-nav-section--adulting', '#c-section-more--adulting');
  dropDownHeader('#c-nav-section--sdp', '#c-section-more--sdp');
  dropDownHeader('#c-nav-section--vancouver', '#c-section-more--vancouver');
});

$(window).resize(function() {
  checkFooter();
  
});
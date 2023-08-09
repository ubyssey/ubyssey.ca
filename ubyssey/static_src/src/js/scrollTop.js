//Get the button:
mybutton = document.getElementById("myBtn");

$(document).on('click', '#myBtn', function (e) {
    e.preventDefault();
    topFunction();
});

// When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function() {scrollFunction()};

function scrollFunction() {
    if (document.documentElement.scrollTop + document.body.offsetHeight > document.getElementsByTagName("footer")[0].offsetTop) {
        mybutton.style.opacity = "0";
    } else if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        mybutton.style.opacity = "0.9";
    } else {
        mybutton.style.opacity = "0";
    }
}

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
} 
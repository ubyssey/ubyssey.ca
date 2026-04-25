//Get the button:
mybutton = document.getElementById("myBtn");

$(document).on('click', '#myBtn', function (e) {
    e.preventDefault();
    topFunction();
});

// When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function() {scrollFunction()};

function scrollFunction() {
    let showPosition = 0;
    const headers = document.getElementsByClassName("header-menu");
    if (headers.length > 0) {
        showPosition = headers[0].offsetTop;
    }

    if (document.body.scrollTop > showPosition || document.documentElement.scrollTop > showPosition) {
        mybutton.classList.add("show");
    } else {
        mybutton.classList.remove("show");
    }
}

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
    let scrollDestination = 0;
    const headers = document.getElementsByClassName("header-menu");
    if (headers.length > 0) {
        scrollDestination = headers[0].offsetTop;
    }
    document.body.scrollTop = scrollDestination; // For Safari
    document.documentElement.scrollTop = scrollDestination; // For Chrome, Firefox, IE and Opera
} 
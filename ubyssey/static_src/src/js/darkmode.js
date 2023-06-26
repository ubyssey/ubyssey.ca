(function () {

    DarkModeToggle();
    
    // Investigate how to implement the dark mode to the system prefers-color-scheme instead of using darkMode variable
    $( document ).ready(function() {
        storedMode = localStorage.getItem("darkMode");
        if (storedMode == null) {
            localStorage.setItem("darkMode", getDarkMode());
    
        } else {
            document.getElementsByTagName('meta')["color-scheme"].content = storedMode;
            setDarkMode(storedMode);
  
        }
     });


})();


function getDarkMode() {
    return document.querySelector('meta[name="color-scheme"]').content;
}

function setDarkMode(mode) {
    if (mode == "light") {
        // nav bar
        var r = document.querySelector(':root');
        r.style.setProperty('--background', 'rgba(255, 255, 255, 0.99)');
        r.style.setProperty('--nav-mobile-background-barely-transparent', 'rgba(249, 249, 249, 0.99)');
        r.style.setProperty('--nav-h3-color', '#5D5D5D');
        r.style.setProperty('--nav-span-color', '#33331E');
        r.style.setProperty('--nav-headline-h1', '#373737');
        r.style.setProperty('--three-bar-logo-color', '#303030');
        $('.ubyssey_small_logo').attr("src","/static/ubyssey/images/ubyssey-logo-small.svg");
        $('.svg-darkmode').attr("d", "M375.7 19.7c-1.5-8-6.9-14.7-14.4-17.8s-16.1-2.2-22.8 2.4L256 61.1 173.5 4.2c-6.7-4.6-15.3-5.5-22.8-2.4s-12.9 9.8-14.4 17.8l-18.1 98.5L19.7 136.3c-8 1.5-14.7 6.9-17.8 14.4s-2.2 16.1 2.4 22.8L61.1 256 4.2 338.5c-4.6 6.7-5.5 15.3-2.4 22.8s9.8 13 17.8 14.4l98.5 18.1 18.1 98.5c1.5 8 6.9 14.7 14.4 17.8s16.1 2.2 22.8-2.4L256 450.9l82.5 56.9c6.7 4.6 15.3 5.5 22.8 2.4s12.9-9.8 14.4-17.8l18.1-98.5 98.5-18.1c8-1.5 14.7-6.9 17.8-14.4s2.2-16.1-2.4-22.8L450.9 256l56.9-82.5c4.6-6.7 5.5-15.3 2.4-22.8s-9.8-12.9-17.8-14.4l-98.5-18.1L375.7 19.7zM269.6 110l65.6-45.2 14.4 78.3c1.8 9.8 9.5 17.5 19.3 19.3l78.3 14.4L402 242.4c-5.7 8.2-5.7 19 0 27.2l45.2 65.6-78.3 14.4c-9.8 1.8-17.5 9.5-19.3 19.3l-14.4 78.3L269.6 402c-8.2-5.7-19-5.7-27.2 0l-65.6 45.2-14.4-78.3c-1.8-9.8-9.5-17.5-19.3-19.3L64.8 335.2 110 269.6c5.7-8.2 5.7-19 0-27.2L64.8 176.8l78.3-14.4c9.8-1.8 17.5-9.5 19.3-19.3l14.4-78.3L242.4 110c8.2 5.7 19 5.7 27.2 0zM256 368a112 112 0 1 0 0-224 112 112 0 1 0 0 224zM192 256a64 64 0 1 1 128 0 64 64 0 1 1 -128 0z")

    } else if (mode == "dark") {
        // nav bar
        var r = document.querySelector(':root');
        r.style.setProperty('--background', 'rgba(0, 0, 0, 0.99)');
        r.style.setProperty('--nav-mobile-background-barely-transparent', 'rgba(1, 1, 1, 0.99)');
        r.style.setProperty('--nav-h3-color', '#5D5D5D');
        r.style.setProperty('--nav-span-color', '#FFFFF');
        r.style.setProperty('--nav-headline-h1', '#5D5D5D');
        r.style.setProperty('--three-bar-logo-color', '#EFEFEF');
        $('.ubyssey_small_logo').attr("src","/static/ubyssey/images/ubyssey_logo_dark_mode.png");
        $('.svg-darkmode').attr("d", "M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z")
    
    }
}
  
function DarkModeToggle() {

    $(document).on('click', '.dark-mode-switcher', function (e) {
        mode = getDarkMode();
    
        if (mode == "dark") {
            document.getElementsByTagName('meta')["color-scheme"].content = "light";
            // document.querySelector('meta[name="color-scheme"]').setAttribute("content", "light");
            mode = "light"

            setDarkMode(mode)

            localStorage.setItem("darkMode", mode);

        } else if (mode == "light") {
            document.getElementsByTagName('meta')["color-scheme"].content = "dark";
            // document.querySelector('meta[name="color-scheme"]').setAttribute("content", "dark");
            mode = "dark"

            setDarkMode(mode)
            localStorage.setItem("darkMode", mode);
        }
    });
}
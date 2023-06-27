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
        $('.ubyssey_small_logo').attr("src","/static/ubyssey/images/ubyssey_logo_dark_mode.svg");
        $('.svg-darkmode').attr("d", "M0 105 l0 -105 650 0 650 0 0 105 0 105 -650 0 -650 0 0 -105z m130 64 c11 -19 10 -20 -9 -10 -27 15 -36 31 -17 31 8 0 20 -9 26 -21z m-66 -21 c20 9 24 8 20 -1 -5 -13 -50 -21 -65 -11 -5 3 -6 10 -3 16 4 7 9 6 15 -3 6 -10 13 -10 33 -1z m256 2 c0 -5 -7 -7 -15 -4 -12 5 -15 -3 -15 -40 0 -34 -4 -46 -15 -46 -11 0 -15 12 -15 46 0 37 -3 45 -15 40 -8 -3 -15 -1 -15 4 0 6 20 10 45 10 25 0 45 -4 45 -10z m53 -10 c-4 -16 0 -20 17 -20 17 0 21 4 17 20 -4 15 0 20 16 20 20 0 22 -4 19 -50 -3 -35 -8 -50 -18 -50 -8 0 -14 10 -14 24 0 20 -4 23 -21 19 -15 -4 -20 -12 -17 -28 4 -17 1 -21 -11 -18 -24 6 -23 103 1 103 11 0 15 -6 11 -20z m167 11 c0 -5 -9 -7 -20 -4 -16 4 -20 0 -20 -17 0 -16 4 -20 15 -16 8 3 15 1 15 -4 0 -6 -7 -10 -15 -10 -17 0 -20 -26 -5 -35 6 -4 17 -1 25 5 9 7 15 8 15 2 0 -14 -28 -23 -53 -17 -19 5 -22 13 -22 55 0 50 0 50 32 50 18 0 33 -4 33 -9z m95 -33 c0 -38 3 -43 24 -46 22 -3 23 -1 20 42 -4 40 -2 46 15 46 16 0 17 -3 8 -12 -7 -7 -12 -29 -12 -50 0 -32 -4 -39 -25 -44 -35 -9 -52 10 -57 61 -2 35 0 45 12 45 11 0 15 -11 15 -42z m160 17 c1 -11 4 -25 8 -32 9 -15 -2 -43 -17 -43 -7 0 -12 8 -12 18 1 9 -3 18 -9 19 -5 1 -10 -7 -9 -17 0 -12 -6 -20 -15 -20 -13 0 -16 11 -16 50 l0 51 35 -3 c27 -2 35 -7 35 -23z m65 11 c0 -24 21 -30 27 -7 3 12 12 21 19 21 11 0 9 -8 -7 -29 -15 -20 -20 -37 -15 -54 5 -21 3 -24 -13 -20 -12 3 -17 11 -14 19 3 8 -4 30 -16 49 -20 34 -20 35 -1 35 11 0 20 -6 20 -14z m130 5 c0 -5 -9 -7 -20 -4 -27 7 -25 -9 5 -35 27 -24 24 -48 -7 -58 -12 -4 -26 0 -36 10 -10 10 -12 16 -5 16 7 0 15 -4 18 -10 9 -15 25 -12 25 5 0 8 -9 19 -20 25 -19 10 -27 40 -13 53 10 10 53 8 53 -2z m80 0 c0 -5 -9 -7 -20 -4 -28 7 -25 -11 5 -31 30 -20 32 -42 4 -56 -23 -13 -49 -7 -49 11 0 8 4 8 15 -1 11 -9 19 -10 26 -3 7 7 2 17 -15 31 -25 19 -33 42 -19 55 10 10 53 8 53 -2z m100 1 c0 -5 -10 -8 -22 -8 -14 1 -23 -5 -23 -14 0 -9 7 -14 18 -12 9 2 17 -2 17 -8 0 -5 -9 -10 -20 -10 -11 0 -20 -6 -20 -14 0 -22 19 -30 36 -15 8 6 17 10 19 7 12 -12 -25 -28 -48 -23 -22 6 -26 13 -29 56 l-3 49 38 0 c20 0 37 -4 37 -8z m56 0 c-2 -4 0 -14 5 -22 8 -13 10 -13 18 0 5 8 7 18 5 22 -3 4 4 8 16 8 20 0 20 -1 6 -16 -24 -24 -38 -54 -32 -70 3 -8 -1 -14 -9 -14 -8 0 -15 9 -15 21 0 23 -18 60 -34 71 -6 4 2 8 17 8 16 0 26 -4 23 -8z m-1159 -54 c-3 -8 -6 -5 -6 6 -1 11 2 17 5 13 3 -3 4 -12 1 -19z m70 6 c-3 -3 -12 -4 -19 -1 -8 3 -5 6 6 6 11 1 17 -2 13 -5z m-3 -63 c3 -5 0 -11 -7 -14 -8 -3 -14 1 -14 9 0 16 13 19 21 5z")
    
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
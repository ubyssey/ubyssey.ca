(function () {

    DarkModeToggle();
    
    // Investigate how to implement the dark mode to the system prefers-color-scheme instead of using darkMode variable
    $( document ).ready(function() {
        storedMode = localStorage.getItem("darkMode");
        
        if (storedMode == null) {
            console.log("Hello ", storedMode);
            localStorage.setItem("darkMode", window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light');
            document.cookie = "lightMode=" + window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
            document.getElementsByTagName('meta')["color-scheme"].content = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    
        } else {
            document.getElementsByTagName('meta')["color-scheme"].content = storedMode;

            setDarkMode(storedMode);
  
        }
     });


})();


function getDarkMode() {

    return   document.getElementsByTagName('meta')["color-scheme"].content
   

}

function setDarkMode(mode) {
    if (mode == "light") {
        // nav bar
        var r = document.querySelector(':root');
        document.firstElementChild.setAttribute("color-css-theme", "light");
        r.classList.replace('darkmode', 'lightmode');

        $('.light-logo').show();
        $('.dark-logo').hide();
        

    } else if (mode == "dark") {
        // nav ba
        var r = document.querySelector(':root');
        document.firstElementChild.setAttribute("color-css-theme", "dark");
        r.classList.replace('lightmode', 'darkmode');
        
        $('.light-logo').hide();
        $('.dark-logo').show();
        
    
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
            document.cookie = "lightMode="+mode;

        } else if (mode == "light") {
            document.getElementsByTagName('meta')["color-scheme"].content = "dark";
            
            // document.querySelector('meta[name="color-scheme"]').setAttribute("content", "dark");
            mode = "dark"

            setDarkMode(mode)
            localStorage.setItem("darkMode", mode);
            document.cookie = "lightMode="+mode;
        }
    });
}
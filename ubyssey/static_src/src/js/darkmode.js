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
        r.style.setProperty('--background-nav', 'rgba(255, 255, 255, 0.99)');
        r.style.setProperty('--background', 'rgba(255, 255, 255, 0.99)');
        r.style.setProperty('--nav-mobile-background-barely-transparent', 'rgba(249, 249, 249, 0.99)');
        r.style.setProperty('--nav-h3-color', '#5D5D5D');
        r.style.setProperty('--nav-span-color', '#33331E');
        r.style.setProperty('--nav-headline-h1', '#373737');
        r.style.setProperty('--authors-title-bio', '#1B1B1B');
        r.style.setProperty('--three-bar-logo-color', '#303030');
        r.style.setProperty('--text_color', '#000000');


        $('.light-logo').show();
        $('.dark-logo').hide();
        

    } else if (mode == "dark") {
        // nav ba
        var r = document.querySelector(':root');
        document.firstElementChild.setAttribute("color-css-theme", "dark");
        r.style.setProperty('--background-nav', '#031723');
        r.style.setProperty('--background', '#031621');
        r.style.setProperty('--nav-mobile-background-barely-transparent', '#031723');
        r.style.setProperty('--nav-h3-color', '#EFEFEF');
        r.style.setProperty('--nav-span-color', '#EFEFEF');
        r.style.setProperty('--nav-headline-h1', '#5D5D5D');
        r.style.setProperty('--authors-title-bio', '#D8D8D8');
        r.style.setProperty('--three-bar-logo-color', '#EFEFEF');
        r.style.setProperty('--text_color', '#D9D9D9');
        
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

        } else if (mode == "light") {
            document.getElementsByTagName('meta')["color-scheme"].content = "dark";
            
            // document.querySelector('meta[name="color-scheme"]').setAttribute("content", "dark");
            mode = "dark"

            setDarkMode(mode)
            localStorage.setItem("darkMode", mode);
        }
    });
}
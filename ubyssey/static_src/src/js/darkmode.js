(function () {

    DarkModeToggle();
    
    // Investigate how to implement the dark mode to the system prefers-color-scheme instead of using darkMode variable
    $( document ).ready(function() {
        storedMode = getCookie("lightMode");
        if (storedMode == "") {
            var colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';

            setDarkMode(colorScheme);

        } else {
            setDarkMode(storedMode);
  
        }
     });


})();


function getDarkMode() {

    return getCookie("lightMode");
   

}

function setDarkMode(mode) {
    document.getElementsByTagName('meta')["color-scheme"].content = mode;
    if (mode == "light") {
        // nav bar
        var r = document.querySelector(':root');
        document.firstElementChild.setAttribute("color-css-theme", "light");
        r.classList.replace('darkmode', 'lightmode');
    } else if (mode == "dark") {
        // nav ba
        var r = document.querySelector(':root');
        document.firstElementChild.setAttribute("color-css-theme", "dark");
        r.classList.replace('lightmode', 'darkmode');
    }
    document.cookie = "lightMode="+mode+ "; path=/;";
}
  
function DarkModeToggle() {

    $(document).on('click', '.dark-mode-switcher', function (e) {
        mode = getDarkMode();
    
        if (mode == "dark") {
            document.getElementsByTagName('meta')["color-scheme"].content = "light";
            
            // document.querySelector('meta[name="color-scheme"]').setAttribute("content", "light");
            mode = "light"

            setDarkMode(mode)

        } else if (mode == "light") {
            document.getElementsByTagName('meta')["color-scheme"].content = "dark";
            
            // document.querySelector('meta[name="color-scheme"]').setAttribute("content", "dark");
            mode = "dark"

            setDarkMode(mode)
        }
    });
}

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }
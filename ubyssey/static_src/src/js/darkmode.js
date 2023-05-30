(function () {

    darkState();
    DarkModeToggle();
  
  })();

function darkState() {
    $(document).on('onload', function (e) {
        storedMode = localStorage.getItem("darkMode");
    
        if (storedMode == null) {
            localStorage.setItem("darkMode", getDarkMode());
    
        } else {
            document.querySelector('meta[name="color-scheme"]').setAttribute("content", storedMode);
        }
    });
  
}
  
  
  
function getDarkMode() {
    return document.querySelector('meta[name="color-scheme"]').content;
}
  
function DarkModeToggle() {

    $(document).on('click', '.dark-mode-switcher', function (e) {
        mode = getDarkMode();
    
        if (mode == "dark") {
            document.querySelector('meta[name="color-scheme"]').setAttribute("content", "light");
            mode = "light"
            // nav bar
            var r = document.querySelector(':root');
            r.style.setProperty('--background', 'rgba(255, 255, 255, 0.99)');
            r.style.setProperty('--nav-mobile-background-barely-transparent', 'rgba(249, 249, 249, 0.99)');
            r.style.setProperty('--nav-h3-color', '#5D5D5D');
            r.style.setProperty('--nav-span-color', '#33331E');
            r.style.setProperty('--nav-headline-h1', '#373737');
            r.style.setProperty('--three-bar-logo-color', '#303030');
        } else if (mode == "light") {
            document.querySelector('meta[name="color-scheme"]').setAttribute("content", "dark");
            mode = "dark"
            // nav bar
            var r = document.querySelector(':root');
            r.style.setProperty('--background', 'rgba(0, 0, 0, 0.99)');
            r.style.setProperty('--nav-mobile-background-barely-transparent', 'rgba(1, 1, 1, 0.99)');
            r.style.setProperty('--nav-h3-color', '#5D5D5D');
            r.style.setProperty('--nav-span-color', '#FFFFF');
            r.style.setProperty('--nav-headline-h1', '#5D5D5D');
            r.style.setProperty('--three-bar-logo-color', '#EFEFEF');
        }
    });
}
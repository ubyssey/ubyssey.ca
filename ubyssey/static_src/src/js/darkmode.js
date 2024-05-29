export function initializeDarkModeToggle() {
    $(document).on('click', '.dark-mode-switcher', function (e) {
        var mode = getDarkMode();
    
        if (mode == "dark") {
            document.getElementsByTagName('meta')["color-scheme"].content = "light";
            
            // document.querySelector('meta[name="color-scheme"]').setAttribute("content", "light");
            mode = "light";
  
            setDarkMode(mode);
  
        } else if (mode == "light") {
            document.getElementsByTagName('meta')["color-scheme"].content = "dark";
            
            // document.querySelector('meta[name="color-scheme"]').setAttribute("content", "dark");
            mode = "dark";
  
            setDarkMode(mode);
        }
    });
  }
  
  export function setDarkMode(mode) {
    document.getElementsByTagName('meta')["color-scheme"].content = mode;
    if (mode == "light") {
        // nav bar
        var r = document.querySelector(':root');
        document.firstElementChild.setAttribute("color-css-theme", "light");
        r.classList.remove("darkmode");
        r.classList.add("lightmode");
    } else if (mode == "dark") {
        // nav ba
        var r = document.querySelector(':root');
        document.firstElementChild.setAttribute("color-css-theme", "dark");
        r.classList.remove("lightmode");
        r.classList.add("darkmode");
    }
    localStorage.setItem("color-scheme", mode);
  }
  
export function getDarkMode() {
    return localStorage.getItem("color-scheme");
}

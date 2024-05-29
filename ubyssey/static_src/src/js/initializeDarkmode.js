import { getDarkMode, setDarkMode } from "./darkmode";

colorScheme = getDarkMode();
if (colorScheme == null) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        var colorScheme = 'dark';        
    } else {
        var colorScheme = 'light';
    }
} 

setDarkMode(colorScheme);
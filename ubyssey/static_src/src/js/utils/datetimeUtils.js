const s = 1000;
const m = 60 * s;
const h = 60 * m;
const d = 24 * h;

const weekDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortMonthsNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];



export function convertToMilliseconds(seconds, minutes, hours, days) {
    return seconds * s + minutes * m + hours * h + days * d;
}
export function timezoneNameInitials(datetime) {
    return datetime.toLocaleDateString(undefined, {day:'2-digit',timeZoneName: 'long' }).substring(4).match(/\b(\w)/g).join('')
}
export function fullDateTimeString(datetime) {
    return shortMonthsNames[datetime.getMonth()] + ". " + String(datetime.getDate()) + ", " + String(datetime.getFullYear()) + ", " + datetime.toLocaleTimeString("en-US") + " " + timezoneNameInitials(datetime);
}

export function timeDeltaString(datetime, max = null) {
    datetime = new Date(datetime);
    const delta = new Date().getTime() - datetime.getTime();
    
    if (max != null) {
        if (delta > max) {
            return fullDateTimeString(datetime);
        }        
    }
    if (delta > d) {
        return String(Math.floor(delta/d)) + "d ago";
    } else if (delta > h) {
        return String(Math.floor(delta/h)) + "h ago";
    } else if (delta > m) {
        return String(Math.floor(delta/m)) + "m ago";
    }
    return String(delta) + "s ago"
}
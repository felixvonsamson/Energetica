/* 
These functions format the numbers that are displayed on the website in a more
readable format for humans.
*/

const _power_units = [" W", " kW", " MW", " GW", " TW"];
const _energy_units = [" Wh", " kWh", " MWh", " GWh", " TWh"];
const _money_units = [
    " <img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/h",
    "k <img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/h",
    "M <img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/h",
];
const _mass_units = [" kg", " t", " kt", " Mt"];
const _mass_rate_units = [" g/h", " kg/h", " t/h", " kt/h"]; // !!! starts at g/h and not kg/h

function general_format(value, units, treshold = 10_000) {
    // Inserts thousands separator and the right unit
    let unit_index = 0;
    while (Math.abs(value) >= treshold && unit_index < units.length - 1) {
        value /= 1_000;
        unit_index += 1;
    }
    formatted_value = `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unit_index]}`
    return formatted_value
}

function general_upgrade_format(value1, value2, units) {
    // formats two values with the right unit for upgrade display
    let unit_index = 0;
    while (value1 >= 10_000 && unit_index < units.length - 1) {
        value1 /= 1_000;
        value2 /= 1_000;
        unit_index += 1;
    }
    return `${value1.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unit_index][0]} -> ${
        value2.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unit_index]}`;
}

function format_upgrade_power(value1, value2) {
    return general_upgrade_format(value1, value2, _power_units);
}

function format_upgrade_money(value1, value2) {
    return general_upgrade_format(value1, value2, _money_units);
}

function format_upgrade_mass(value1, value2) {
    return general_upgrade_format(value1, value2, _mass_units);
}

// Price :
function format_money(price, coin="<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>") {
    const units = [coin, "k" + coin, "M" + coin, "Md" + coin];
    return general_format(price, units);
}

// Prices for balance display :
function format_money_long(price) {
    formatted_value = price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'") + "<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>";
    return formatted_value;
}

// Power :
function format_power(power, treshold = 10_000) {
    return general_format(power, _power_units, treshold);
}

function format_power_special(energy, interval) {
    // Special format for x-ticks for zoomed in market graph with more precision
    let unit_index = 0;
    while (energy >= 10_000 && unit_index < _power_units.length - 1) {
        energy /= 1_000;
        interval /= 1_000;
        unit_index += 1;
    }
    const decimalPlaces = (interval.toString().split(".")[1] || "").length;
    let [integerPart, decimalPart] = energy.toFixed(decimalPlaces).split('.');
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return `${integerPart}${decimalPart ? '.' + decimalPart : ''}${_power_units[unit_index]}`;
}

// Energy :
function format_energy(energy, treshold = 10_000) {
    return general_format(energy, _energy_units, treshold);
}

// Mass rate :
function format_mass_rate(mass_rate, treshold = 10_000) {
    return general_format(mass_rate*1_000, _mass_rate_units, treshold); // the *1000 is to convert from kg to g
}

// Mass
function format_mass(mass, treshold = 10_000) {
    return general_format(mass, _mass_units, treshold);
}

// Duration :
function format_duration(seconds) {
    const days = Math.floor(seconds / 86_400);
    seconds -= days * 86_400;
    const hours = Math.floor(seconds / 3_600);
    seconds -= hours * 3_600;
    const minutes = Math.round(seconds / 60);

    let duration = "";
    if (days > 0) {
        duration += `${days}d `;
    }
    if (hours > 0) {
        duration += `${hours}h `;
    }
    if (minutes > 0) {
        duration += `${minutes}m`;
    }
    return duration.trim();
}

function format_days(seconds) {
    return Math.round(seconds / 86_400);
}

function format_duration_graphs(ticks) {
    let seconds = ticks * clock_time;
    if (seconds == 0) {
        return "now";
    }

    const months = Math.floor(seconds / 2_592_000);
    seconds -= months * 2_592_000;
    const days = Math.floor(seconds / 86_400);
    seconds -= days * 86_400;
    const hours = Math.floor(seconds / 3_600);
    seconds -= hours * 3_600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    let duration = "t - ";
    if (months > 0) {
        duration += `${months}mo `;
    }
    if (days > 0) {
        duration += `${days}d `;
    }
    if (hours > 0) {
        duration += `${hours}h `;
    }
    if (minutes > 0) {
        duration += `${minutes}m `;
    }
    if (seconds > 0) {
        duration += `${seconds}s`;
    }
    return duration.trim();
}

function calculate_delivery(delta_q, delta_r, trasport_speed) {
    const dist = Math.sqrt(
        2 * (Math.pow(delta_q, 2) + Math.pow(delta_r, 2) + delta_q * delta_r)
    );
    return format_duration(dist * trasport_speed);
}

function formatDateTime(dateTimeString) {
    const dateTime = new Date(dateTimeString);
    const now = new Date();
    const date = dateTime.getDate();
    const monthIndex = dateTime.getMonth();
    const hours = dateTime.getHours().toString().padStart(2, '0');
    const minutes = dateTime.getMinutes().toString().padStart(2, '0');
    const seconds = dateTime.getSeconds().toString().padStart(2, '0');
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    let formated_date;
    if (dateTime.toDateString() === now.toDateString()) {
        // If the date is today, return the time format
        formated_date = `${hours}:${minutes}:${seconds}`;
    } else {
        // If the date is not today, return the date + time format
        formated_date = `${date} ${months[monthIndex]} ${hours}:${minutes}:${seconds}`;
    }
    return formated_date;
}

function formatDateString(dateString) {
    // This function formats the datetime of a message to a time if the message is from the same day, otherwise it returns the date and time
    var date = new Date(dateString);
    var currentDate = new Date();
    if (date.toDateString() === currentDate.toDateString()) {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris' });
    } else {
        var formattedDate = date.getDate() + ' ' + date.toLocaleString('default', { month: 'short' }) + '. ' +
            date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris' });
        return formattedDate;
    }
}
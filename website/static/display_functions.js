/* 
These functions format the numbers that are displayed on the website in a more
readable format for humans.
*/

// Inserts spaces as a thousands separator and the right unit
function general_format(value, units, write=false) {
    let unit_index = 0;
    while (value >= 10000 && unit_index < units.length - 1) {
        value /= 1000;
        unit_index += 1;
    }
    formatted_value = `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unit_index]}`
    if (write){
        document.write(formatted_value);
    }
    return formatted_value
}

// Inserts spaces as a thousands separator and the right unit for current and future value
function upgrade_format(value, units, factor) {
    let unit_index = 0;
    let value2 = value * factor;
    while (value >= 10000 && unit_index < units.length - 1) {
        value /= 1000;
        value2 /= 1000;
        unit_index += 1;
    }
    document.write(
        `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
            units[unit_index][0]
        } -> ${value2.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
            units[unit_index]
        }`
    );
}

function display_upgrade_W(price, factor) {
    const units = [" W", " kW", " MW", " GW", " TW"];
    upgrade_format(price, units, factor);
}

function display_upgrade_money(price, factor) {
    const units = [
        " <img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/day",
        "k <img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/day",
        "M <img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/day",
    ];
    upgrade_format(price, units, factor);
}

function display_upgrade_kg(price, factor) {
    const units = [" kg", " t", " kt", " Mt"];
    upgrade_format(price, units, factor);
}

// Price :
function display_money(price, write=true) {
    const units = [
        "<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
        "k<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
        "M<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
        "Md<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
    ];
    return general_format(price, units, write);
}

// Prices for balance display :
function display_money_long(price, write=true) {
    formatted_value = `<span id="money">${price
        .toFixed(0)
        .replace(/\B(?=(\d{3})+(?!\d))/g, "'")}</span>
        <img src="/static/images/icons/coin.svg" class="coin" alt="coin">`
    if(write){
        document.write(formatted_value);
    }
    return formatted_value;
    
}

// Power :
function display_W(power, write=true) {
    const units = [" W", " kW", " MW", " GW", " TW"];
    return general_format(power, units, write);
}

// Energy :
function display_Wh(energy, write=true) {
    const units = [" Wh", " kWh", " MWh", " GWh", " TWh"];
    return general_format(energy, units, write);
}

// Mass rate :
function display_kgh(mass_rate, write=true) {
    const units = [" kg/h", " t/h"];
    return general_format(mass_rate, units, write);
}

// Mass
function display_kg(mass, write=true) {
    const units = [" kg", " t", " kt", " Mt"];
    return general_format(mass, units, write);
}

// Duration :
function display_duration(seconds, write=true) {
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
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
    if(write){
        document.write(duration.trim());
    }
    return duration.trim();
}

function display_days(seconds, write=true) {
    const days = Math.round(seconds / 86400);
    if(write){
        document.write(days);
    }
    return days;
}

function to_string(inputFloat) {
    var resultString = inputFloat.toString();
    if (resultString.includes(".")) {
        resultString = resultString.replace(/(\.[0-9]*[1-9])0+$/, "$1");
    }
    document.write(resultString);
}

function calculate_delivery(delta_q, delta_r, trasport_speed) {
    const dist = Math.sqrt(
        2 * (Math.pow(delta_q, 2) + Math.pow(delta_r, 2) + delta_q * delta_r)
    );
    display_duration(dist * trasport_speed);
}

function formatDateTime(dateTimeString, write=true) {
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
    if (write){
        document.write(formated_date);
    }
    return formated_date;
  }

function formatted_money(amount) {
    return `${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`;
}

function formatDateString(dateString) {
    var date = new Date(dateString);
    var currentDate = new Date();
    if (date.toDateString() === currentDate.toDateString()) {
        return date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris'});
    } else {
        var formattedDate = date.getDate() + ' ' + date.toLocaleString('default', { month: 'short' }) + '. ' +
                            date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris'});
        return formattedDate;
    }
}
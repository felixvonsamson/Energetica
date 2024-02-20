/* 
These functions format the numbers that are displayed on the website in a more
readable format for humans.
*/

// Inserts spaces as a thousands separator and the right unit
function general_format(value, units) {
    let unit_index = 0;
    while (value >= 10000 && unit_index < units.length - 1) {
        value /= 1000;
        unit_index += 1;
    }
    document.write(
        `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
            units[unit_index]
        }`
    );
}

// Inserts spaces as a thousands separator and the right unit
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
function display_money(price) {
    const units = [
        "<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
        "k<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
        "M<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
        "Md<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
    ];
    general_format(price, units);
}

// Prices for balance display :
function display_money_long(price) {
    document.write(
        `<span id="money">${price
            .toFixed(0)
            .replace(/\B(?=(\d{3})+(?!\d))/g, "'")}</span>
            <img src="/static/images/icons/coin.svg" class="coin" alt="coin">`
    );
}

function formatted_money(amount) {
    return `${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`;
}

// Power :
function display_W(power) {
    const units = [" W", " kW", " MW", " GW", " TW"];
    general_format(power, units);
}

// Energy :
function display_Wh(energy) {
    const units = [" Wh", " kWh", " MWh", " GWh", " TWh"];
    general_format(energy, units);
}

// Mass rate :
function display_kgh(mass_rate) {
    const units = [" kg/h", " t/h"];
    general_format(mass_rate, units);
}

// Mass
function display_kg(mass) {
    const units = [" kg", " t", " kt", " Mt"];
    general_format(mass, units);
}

// Duration :
function display_duration(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    seconds = Math.round(seconds);

    let duration = "";
    if (days > 0) {
        duration += `${days}d `;
    }
    if (hours > 0) {
        duration += `${hours}h `;
    }
    if (minutes > 0) {
        duration += `${minutes}m `;
    }
    if (seconds > 0 || duration === "") {
        duration += `${seconds}s`;
    }
    document.write(duration.trim());
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
  
    if (dateTime.toDateString() === now.toDateString()) {
        // If the date is today, return the time format
        document.write(`${hours}:${minutes}:${seconds}`);
    } else {
        // If the date is not today, return the date + time format
        document.write(`${date} ${months[monthIndex]} ${hours}:${minutes}:${seconds}`);
    }
  }
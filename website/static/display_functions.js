/* 
These functions format the numbers that are displayed on the website in a more
readable format for humans.
*/

// Inserts spaces as a thousands separator and the right unit
function general_format(value, units){
  let unit_index = 0;
  while (value >= 10000 && unit_index < units.length - 1) {
    value /= 1000;
    unit_index += 1;
  }
  document.write(
    `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${
      units[unit_index]
    }`,
  );
}

// Price :
function display_CHF(price) {
  const units = [" CHF", "k CHF", "M CHF", "Md CHF"];
  general_format(price, units);
}

// Prices for balance display :
function display_CHF_long(price) {
  document.write(
    `${price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} CHF`,
  );
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
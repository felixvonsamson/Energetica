function display_CHF(price) {
    const units = [' CHF', 'k CHF', 'M CHF', 'Md CHF'];
    let unit_index = 0;
    while (price >= 10000 && unit_index < units.length - 1) {
        price /= 1000;
        unit_index += 1;
    }
    document.write(`${price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${units[unit_index]}`);
}

function display_CHF_long(price) {
  document.write(`${price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} CHF`);
}

function display_W(power) {
    const units = ['W', 'kW', 'MW', 'GW', 'TW'];
    let unit_index = 0;
    while (power >= 10000 && unit_index < units.length - 1) {
        power /= 1000;
        unit_index += 1;
    }
    document.write(`${power.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${units[unit_index]}`);
}

function display_Wh(energy) {
    const units = ['Wh', 'kWh', 'MWh', 'GWh', 'TWh'];
    let unit_index = 0;
    while (energy >= 10000 && unit_index < units.length - 1) {
        energy /= 1000;
        unit_index += 1;
    }
    document.write(`${energy.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${units[unit_index]}`);
}

function display_duration(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
  
    let duration = '';
    if (days > 0) {
      duration += `${days}d `;
    }
    if (hours > 0) {
      duration += `${hours}h `;
    }
    if (minutes > 0) {
      duration += `${minutes}m `;
    }
    if (seconds > 0 || duration === '') {
      duration += `${seconds}s`;
    }
    document.write(duration.trim());
}

function display_kgh(mass) {
    document.write(`${mass.toFixed(0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kg/h`);
}

function display_kg(mass) {
  if (mass >= 10000) {
    var tons = (mass / 1000).toFixed(0);
    document.write( tons + " t");
  } else {
    var roundedMass = mass.toFixed(0);
    document.write(roundedMass.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " kg");
  }
}
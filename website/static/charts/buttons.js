let data = {};
let buttons = [];

let margin = 40;
let data_len = 360;
let graph_h, graph_w;
let maxSum;
let graph;
let fill_alt = 0;

let resolution;
let res;
let res_to_factor;
if (clock_time == 60){
    resolution = ["1h", "6h", "36h", "9 days", "2 months", "year"];
    res = "1h";
    res_to_factor = {
        "1h": 1,
        "6h": 1,
        "36h": 6,
        "9 days": 36,
        "2 months": 216,
        "year": 1296,
    };
}else if(clock_time == 30){
    resolution = ["30min", "3h", "18h", "4 days", "month", "6 months"];
    res = "30min";
    res_to_factor = {
        "30min": 1,
        "3h": 1,
        "18h": 6,
        "4 days": 36,
        "month": 216,
        "6 months": 1296,
    };
}else{
    resolution = ["×1 (60)", "×1 (360)", "×6", "×36", "×216", "x1296"];
    res = "×1 (60)";
    res_to_factor = {
        "×1 (60)": 1,
        "×1 (360)": 1,
        "×6)": 6,
        "×36": 36,
        "×216": 216,
        "×1296": 1296,
    };
}

let cols_and_names = {};

class Button {
    constructor(resolution) {
        this.res = resolution;
        this.active = false;
    }
    display_button() {
        push();
        if (this.active) {
            fill(220);
        } else {
            fill(180);
        }
        rect(0, 0, graph_w / resolution.length, margin);
        fill(0);
        textSize(20);
        textAlign(CENTER, CENTER);
        text(this.res, (0.5 * graph_w) / resolution.length, 0.5 * margin - 5);
        pop();
    }
}

function preload() {
    font = loadFont("static/fonts/Baloo2-VariableFont_wght.ttf");
    balooBold = loadFont("static/fonts/Baloo2-SemiBold.ttf");
    coin = loadImage("static/images/icons/coin.svg");
}

function setup() {
    cols_and_names = {
        "O&M_costs": [color(106, 4, 15), "O&M costs"],

        watermill: [color(0, 180, 216), "Watermill"],
        small_water_dam: [color(0, 119, 182), "Water dam (S)"],
        large_water_dam: [color(3, 4, 94), "Water dam (L)"],
        nuclear_reactor: [color(191, 210, 0), "Nuclear reactor"],
        nuclear_reactor_gen4: [color(128, 185, 24), "Gen 4 Nuclear"],
        steam_engine: [color(151, 157, 172), "Steam engine"],
        coal_burner: [color(0, 0, 0), "Coal burner"],
        oil_burner: [color(166, 99, 204), "Oil burner"],
        gas_burner: [color(171, 196, 255), "Gas burner"],
        combined_cycle: [color(92, 77, 125), "Combined cycle"],
        windmill: [color(156, 197, 161), "Windmill"],
        onshore_wind_turbine: [color(73, 160, 120), "Wind onshore"],
        offshore_wind_turbine: [color(33, 104, 105), "Wind offshore"],
        CSP_solar: [color(255, 170, 0), "CSP solar"],
        PV_solar: [color(255, 234, 0), "PV solar"],

        small_pumped_hydro: [color(0, 150, 199), "Hydrostrg. (S)"],
        large_pumped_hydro: [color(2, 62, 138), "Hydrostrg. (L)"],
        lithium_ion_batteries: [color(108, 88, 76), "Li-ion batteries"],
        solid_state_batteries: [color(169, 132, 103), "SS batteries"],
        compressed_air: [color(255, 179, 198), "Compr. air"],
        molten_salt: [color(119, 47, 26), "Molten salt"],
        hydrogen_storage: [color(144, 241, 239), "H2 storage"],

        imports: [color(255, 89, 94), "Imports"],
        exports: [color(138, 201, 38), "Exports"],
        dumping: [color(208, 0, 0), "Dumping"],

        coal_mine: [color(73, 80, 87), "Coal mines"],
        oil_field: [color(181, 23, 158), "Oil fields"],
        gas_drilling_site: [color(76, 201, 240), "Gas fields"],
        uranium_mine: [color(238, 239, 32), "Uran. mines"],
        industry: [color(188, 108, 37), "Industry"],
        research: [color(255, 255, 255), "Research"],
        construction: [color(255, 123, 0), "Constructions"],
        transport: [color(106, 0, 244), "Shipments"],
        carbon_capture: [color(173, 181, 189), "CO2 capture"],

        coal: [color(0, 0, 0), "Coal"],
        oil: [color(166, 99, 204), "Oil"],
        gas: [color(171, 196, 255), "Gas"],
        uranium: [color(191, 210, 0), "Uranium"],
    };
    let canvas_width = 0.7 * windowWidth;
    let canvas_height = 0.7 * ratio * windowWidth;
    if (windowWidth < 1200) {
        canvas_width = windowWidth;
        canvas_height = ratio * windowWidth;
    }
    let canvas = createCanvas(min(canvas_width, 1200), min(canvas_height, ratio*1200));
    margin = min(40, width / 25);
    canvas.parent("graph");
    textAlign(CENTER, CENTER);
    textFont(font);
    for (let i = 0; i < resolution.length; i++) {
        buttons[i] = new Button(resolution[i]);
    }
    buttons[0].active = true;
    update_graph();
}

function update_graph() {
    calc_size();
    resetMatrix();
    regen(res);
}

function mousePressed() {
    if (
        (mouseY > height - margin - 10) &
        (mouseX > 1.5 * margin) &
        (mouseX < graph_w + 1.5 * margin)
    ) {
        let i = floor(((mouseX - 1.5 * margin) * buttons.length) / graph_w);
        for (let j = 0; j < buttons.length; j++) {
            buttons[j].active = false;
        }
        buttons[i].active = true;
        res = buttons[i].res;
        update_graph();
    }
}

function reduce(arr, res) {
    if (res == resolution[0]) {
        return arr[0].slice(-60);
    }
    if(res == resolution[1]){
        return arr[0];
    }
    if(res == resolution[2]){
        return arr[1];
    }
    if(res == resolution[3]){
        return arr[2];
    }
    if(res == resolution[4]){
        return arr[3];
    }
    return arr[3];
}

function time_unit(res, ct) {
    if(ct == 60){
        if (res == "1h") {
            return ["1h", "50min", "40min", "30min", "20min", "10min", "now"];
        } else if (res == "6h") {
            return ["6h", "5h", "4h", "3h", "2h", "1h", "now"];
        } else if (res == "36h") {
            return ["36h", "30h", "24h", "18h", "12h", "6h", "now"];
        } else if (res == "9 days") {
            return ["9d", "7.5d", "6d", "4.5d", "3d", "1.5d", "now"];
        } else if (res == "2 months") {
            return ["54d", "45d", "36d", "27d", "18d", "9d", "now"];
        } else if (res == "year") {
            return ["12m", "10m", "8m", "6m", "4m", "2m", "now"];
        }
    }else if(ct == 30){
        if (res == "30min") {
            return ["30min", "25min", "20min", "15min", "10min", "5min", "now"];
        } else if (res == "3h") {
            return ["3h", "2h30", "2h", "1h30", "1h", "30min", "now"];
        } else if (res == "18h") {
            return ["18h", "15h", "12h", "9h", "6h", "3h", "now"];
        } else if (res == "4 days") {
            return ["108h", "90h", "72h", "54h", "36h", "18h", "now"];
        } else if (res == "month") {
            return ["27d", "22.5d", "18d", "13.5d", "9d", "4.5d", "now"];
        } else if (res == "6 months") {
            return ["6m", "5m", "4m", "3m", "2m", "1m", "now"];
        }
    }else{
        return [res, "", "", "", "", "", "now"];
    }
}

function y_units(maxNumber) {
    let interval = Math.floor(maxNumber / 5);
    const orderOfMagnitude = Math.floor(Math.log10(interval));
    const firstDigit = Math.floor(interval / 10 ** orderOfMagnitude);
    interval = firstDigit * 10 ** orderOfMagnitude;
    let values = [];
    for (let i = 0; i <= maxNumber; i += interval) {
        values.push(i);
    }
    return values;
}

function display_W(power) {
    const units = [" W", " kW", " MW", " GW", " TW"];
    return general_format(power, units);
}

function display_Wh(energy) {
    const units = [" Wh", " kWh", " MWh", " GWh", " TWh"];
    return general_format(energy, units);
}

function display_kgh(mass_rate) {
    const units = [" kg/h", " t/h"];
    return general_format(mass_rate, units);
}

function display_kg(mass) {
    const units = [" kg", " t", " kt", " Mt"];
    return general_format(mass, units);
}

function display_money(amount) {
    const units = ["", "k", "M"];
    return general_format(amount, units);
}

function general_format(value, units) {
    let unit_index = 0;
    while (Math.abs(value) >= 10000 && unit_index < units.length - 1) {
        value /= 1000;
        unit_index += 1;
    }
    return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
        units[unit_index]
    }`;
}

function display_duration(ticks) {
    let seconds = ticks * clock_time;
    if (seconds == 0) {
        return "now";
    }

    const months = Math.floor(seconds / 2592000);
    seconds -= months * 2592000;
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
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

function alternate_fill() {
    if (fill_alt == 1) {
        fill_alt = 0;
        fill(214, 199, 154);
    } else {
        fill_alt = 1;
        fill(229, 217, 182);
    }
}

function display_W_long(power) {
    return `${power.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} W`;
}

function display_Wh_long(energy) {
    return `${energy.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} Wh`;
}

function display_kg_long(mass) {
    return `${mass.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} kg`;
}

function display_kgh_long(mass) {
    return `${mass.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} kg/h`;
}
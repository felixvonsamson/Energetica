let data = {};
let buttons = [];
let caps = {};

let margin = 40;
let data_len = 1440;
let graph_h, graph_w;
let maxSum;
let graph;
let fill_alt = 0;

let active_view = "Revenues";
const resolution = ["6h", "day", "5 days", "month", "6 months"];
let res = "6h";
const res_to_data = {
    "6h" : ["day", 1],
    "day" : ["day", 1],
    "5 days" : ["5_days", 5],
    "month" : ["month", 30],
    "6 months" : ["6_months", 180]
}

let cols_and_names = {};

class Button{
    constructor(resolution){
        this.res = resolution
        this.active = false;
    }
    display_button(){
        push();
        if(this.active){
            fill(220);
        }else{
            fill(180);
        }
        rect(0, 0, graph_w/resolution.length, margin);
        fill(0);
        textSize(20);
        textAlign(CENTER, CENTER);
        text(this.res, 0.5*graph_w/resolution.length, 0.5*margin-5);
        pop();
    }
}

function preload() {
    font = loadFont('static/fonts/Baloo2-VariableFont_wght.ttf');
    coin = loadImage('static/images/icons/coin.svg');
}

function setup() {
    cols_and_names = {
        "O&M_costs": [color(106, 4, 15), "O&M costs"],

        "watermill": [color(0, 180, 216), "Watermill"],
        "small_water_dam": [color(0, 119, 182), "Water dam (S)"],
        "large_water_dam": [color(3, 4, 94), "Water dam (L)"],
        "nuclear_reactor": [color(191, 210, 0), "Nuclear reactor"],
        "nuclear_reactor_gen4": [color(128, 185, 24), "Gen 4 Nuclear"],
        "steam_engine": [color(151, 157, 172), "Steam engine"],
        "coal_burner": [color(0, 0, 0), "Coal burner"],
        "oil_burner": [color(166, 99, 204), "Oil burner"],
        "gas_burner": [color(171, 196, 255), "Gas burner"],
        "combined_cycle": [color(92, 77, 125), "Combined cycle"],
        "windmill": [color(156, 197, 161), "Windmill"],
        "onshore_wind_turbine": [color(73, 160, 120), "Wind onshore"],
        "offshore_wind_turbine": [color(33, 104, 105), "Wind offshore"],
        "CSP_solar": [color(255, 170, 0), "CSP solar"],
        "PV_solar": [color(255, 234, 0), "PV solar"],

        "small_pumped_hydro": [color(0, 150, 199), "Hydrostrg. (S)"],
        "large_pumped_hydro": [color(2, 62, 138), "Hydrostrg. (L)"],
        "lithium_ion_batteries": [color(108, 88, 76), "Li-ion batteries"],
        "solid_state_batteries": [color(169, 132, 103), "SS batteries"],
        "compressed_air": [color(255, 179, 198), "Compr. air"],
        "molten_salt": [color(119, 47, 26), "Molten salt"],
        "hydrogen_storage": [color(144, 241, 239), "H2 storage"],

        "imports": [color(255, 89, 94), "Imports"],
        "exports": [color(138, 201, 38), "Exports"],
        "dumping": [color(208, 0, 0), "Dumping"],

        "coal_mine": [color(73, 80, 87), "Coal mines"],
        "oil_field": [color(181, 23, 158), "Oil fields"],
        "gas_drilling_site": [color(76, 201, 240), "Gas fields"],
        "uranium_mine": [color(238, 239, 32), "Uran. mines"],
        "industry": [color(188, 108, 37), "Industry"],
        "research": [color(255, 255, 255), "Research"],
        "construction": [color(255, 123, 0), "Constructions"],
        "transport": [color(106, 0, 244), "Transport"],
        "CO2_capture": [color(173, 181, 189), "CO2 capture"],

        "coal": [color(0,0,0), "Coal"],
        "oil": [color(166, 99, 204), "Oil"],
        "gas": [color(171, 196, 255), "Gas"],
        "uranium": [color(191, 210, 0), "Uranium"],
    }
    let canvas_width = 0.7*windowWidth
    let canvas_height = 0.42*windowWidth
    if (windowWidth<1200){
        canvas_width = windowWidth
        canvas_height = 0.6*windowWidth
    }
    let canvas = createCanvas(min(canvas_width, 1200), min(canvas_height, 720));
    margin = min(40, width/25);
    canvas.parent("graph");
    textAlign(CENTER, CENTER);
    textFont(font);
    for (let i = 0; i < resolution.length; i++) {
      buttons[i] = new Button(resolution[i]);
    }
    buttons[0].active = true;
    update_graph();
    updateAtFiveSeconds();
}

function updateAtFiveSeconds() {
    const now = new Date();
    const seconds = now.getSeconds();
    // Calculate the milliseconds until the next '05' seconds
    let millisecondsUntilNextFive = ((60-seconds+5) % 60) * 1000;
    if(millisecondsUntilNextFive==0){
        millisecondsUntilNextFive = 60000;
    }
    setTimeout(function () {
        update_graph();
        updateAtFiveSeconds();
    }, millisecondsUntilNextFive);
}

function update_graph(){
    calc_size();
    resetMatrix();
    regen(res);
}

function mousePressed(){
    if(mouseY>height-margin-10 & mouseX>1.5*margin & mouseX<graph_w+1.5*margin){
        let i = floor((mouseX-1.5*margin)*buttons.length/graph_w);
        for(let j = 0; j<buttons.length; j++){
            buttons[j].active = false;
        }
        buttons[i].active = true;
        res = buttons[i].res;
        update_graph();
    }
}

function reduce(arr1, arr2, res, t) {
    arr2 = arr2.slice(1, t+1); //first value form today is last value from yesterday
    let result;
    let factor = res_to_data[res][1]
    if(factor != 1){
        result = arr1;
        for (let i = 0; i < arr2.length; i += factor) {
            const slice = arr2.slice(i, i + factor);
            const sum = slice.reduce((acc, currentValue) => acc + currentValue, 0);
            const average = sum / slice.length;
            result.push(average);
        }
    }else{
        result = arr1.concat(arr2);
    }
    if(res == "6h"){
        result = result.slice(-360);
    }else{
        result = result.slice(-1440);
    }
    return result;
}

function time_unit(res){
    if(res == "6h"){
        return ["6h", "5h", "4h", "3h", "2h", "1h", "now"];
    }else if(res == "day"){
        return ["24h", "20h", "16h", "12h", "8h", "4h", "now"];
    }else if(res == "5 days"){
        return ["5d", "4d", "3d", "2d", "1d", "now"];
    }else if(res == "month"){
        return ["30d", "25d", "20d", "15d", "10d", "5d", "now"];
    }else if(res == "6 months"){
        return ["6m", "5m", "4m", "3m", "2m", "1m", "now"];
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
  
function general_format(value, units){
    let unit_index = 0;
    while (Math.abs(value) >= 10000 && unit_index < units.length - 1) {
        value /= 1000;
        unit_index += 1;
    }
    return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
        units[unit_index]}`;
}
  
function display_duration(minutes) {
    if(minutes == 0){
        return "now";
    }

    const months = Math.floor(minutes / 43200);
    minutes -= months * 43200;
    const days = Math.floor(minutes / 1440);
    minutes -= days * 1440;
    const hours = Math.floor(minutes / 60);
    minutes -= hours * 60;

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
        duration += `${minutes}m`;
    }
    return duration.trim();
}

function alternate_fill(){
    if(fill_alt == 1){
        fill_alt = 0;
        fill(214, 199, 154);
    }else{
        fill_alt = 1;
        fill(229, 217, 182);
    }
}
  
function display_W_long(power) {
    return `${power.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} W`
}

function display_Wh_long(energy) {
    return `${energy.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} Wh`
}

function display_kg_long(mass) {
    return `${mass.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} kg`
}

function display_kgh_long(mass) {
    return `${mass.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} kg/h`
}

function display_money_long(amount) {
    return `${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}

function change_view(view){
    resetMatrix();
    graph = null;
    const boldElements = document.querySelectorAll('b');
    boldElements.forEach(function(boldElement) {
        boldElement.classList.remove('active');});
    let button = document.getElementById(view);
    button.classList.add("active");
    active_view = view;
    update_graph();
}


let data = {};
let buttons = [];
let caps = {};

let margin = 40;
let data_len = 1440;
let graph_h, graph_w;
let maxSum;
let graph;
let fill_alt = 0;

let active_view = "Generation";
const resolution = ["6h", "day", "5 days", "month", "6 months"];
let res = "day";
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
        text(this.res, 0.5*graph_w/resolution.length, 0.5*margin);
        pop();
    }
}

function setup() {
    cols_and_names = {
        "watermill": [color(40, 145, 201), "Watermill"],
        "small_water_dam": [color(12, 64, 237), "Water dam (S)"],
        "large_water_dam": [color(15, 0, 153), "Water dam (L)"],
        "nuclear_reactor": [color(232, 181, 28), "Nuclear reactor"],
        "nuclear_reactor_gen4": [color(255, 220, 66), "Gen 4 Nuclear"],
        "shallow_geothermal_plant": [color(227, 66, 149), "Geothermy (S)"],
        "deep_geothermal_plant": [color(212, 8, 83), "Geothermy (L)"],
        "steam_engine": [color(140, 140, 140), "Steam engine"],
        "coal_burner": [color(0, 0, 0), "Coal burner"],
        "oil_burner": [color(69, 69, 69), "Oil burner"],
        "gas_burner": [color(179, 189, 201), "Gas burner"],
        "combined_cycle": [color(89, 150, 142), "Combined cycle"],
        "windmill": [color(148, 234, 255), "Windmill"],
        "wind_turbine": [color(44, 239, 242), "Wind turbine"],
        "large_wind_turbine": [color(0, 196, 199), "Wind turbine (L)"],
        "CSP_solar": [color(237, 194, 0), "CSP solar"],
        "PV_solar": [color(255, 250, 0), "PV solar"],
        
        "small_pumped_hydro": [color(12, 64, 237), "Hydrostrg. (S)"],
        "large_pumped_hydro": [color(15, 0, 153), "Hydrostrg. (L)"],
        "lithium_ion_batteries": [color(184, 214, 64), "Li-ion batteries"],
        "solid_state_batteries": [color(136, 255, 0), "SS batteries"],
        "compressed_air": [color(201, 160, 219), "Compr. air"],
        "molten_salt": [color(161, 116, 50), "Molten salt"],
        "hydrogen_storage": [color(29, 240, 226), "Hydrolysis"],
        
        "imports": [color(255, 0, 0), "Imports"],
        "exports": [color(0, 255, 0), "Exports"],
        "dumping": [color(255, 0, 0), "Dumping"],

        "coal_mine": [color(0, 0, 0), "Coal mines"],
        "oil_field": [color(69, 69, 69), "Oil fields"],
        "gas_drilling_site": [color(179, 189, 201), "Gas fields"],
        "uranium_mine": [color(137, 255, 59), "Uran. mines"],
        "industriy": [color(73, 95, 196), "Industry"],
        "research": [color(255, 255, 255), "Research"],
        "construction": [color(245, 145, 22), "Constructions"],

        "coal": [color(0,0,0), "Coal"],
        "oil": [color(184, 33, 78), "Oil"],
        "gas": [color(64, 119, 201), "Gas"],
        "uranium": [color(30, 179, 0), "Uranium"],
    }
  
    let canvas = createCanvas(1200, 720);
    canvas.parent("graph");
    textAlign(CENTER, CENTER);
    for (let i = 0; i < resolution.length; i++) {
      buttons[i] = new Button(resolution[i]);
    }
    buttons[1].active = true;
    setInterval(update_graph, 60000);
    update_graph();
}

function draw() {
    if(active_view == "Generation"){
        draw_generation();
    }else if(active_view == "Demand"){
        draw_demand();
    }else if(active_view == "Storage"){
        draw_storage();
    }else if(active_view == "Ressources"){
        draw_ressources();
    }else{
        draw_emissions();
    }
}

function calc_size(){
    graph_h = height-2*margin-20;
    if(active_view == "Generation" | active_view == "Storage"){
        graph_w = width-4.5*margin;
    }else if(active_view == "Demand" | active_view == "Emissions"){
        graph_w = width-3*margin;
    }else{
        graph_w = width-6*margin;
    }  
}

function update_graph(){
    calc_size();
    if(active_view == "Generation"){
        regen_generation(res);
    }else if(active_view == "Demand"){
        regen_demand(res);
    }else if(active_view == "Storage"){
        regen_storage(res);
    }else if(active_view == "Ressources"){
        regen_ressources(res);
    }else{
        regen_emissions(res);
    }
}

function mousePressed(){
    if(mouseY>height-margin-10 & mouseX>margin & mouseX<graph_w+margin){
        let i = floor((mouseX-margin)*buttons.length/graph_w);
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
  
function general_format(value, units){
    let unit_index = 0;
    while (value >= 10000 && unit_index < units.length - 1) {
        value /= 1000;
        unit_index += 1;
    }
    return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${
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
    return `${power.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} W`
}

function display_Wh_long(energy) {
    return `${energy.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Wh`
}

function display_kg_long(mass) {
    return `${mass.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kg`
}

function change_view(view){
    graph = null;
    let title = document.getElementById("graph_title");
    title.innerHTML = view;
    const boldElements = document.querySelectorAll('b');
    boldElements.forEach(function(boldElement) {
        boldElement.classList.remove('active');});
    let button = document.getElementById(view);
    button.classList.add("active");
    active_view = view;
    update_graph();
}

let buttons = [];

let margin = 40;
let graph_h, graph_w;
let demand, supply;
let maxPrice;
let minPrice;
let maxCap;
let graph;
let fill_alt = 0;

let cols_and_names = {};

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
    }
  
    let canvas = createCanvas(1200, 720);
    graph_h = height-margin-20;
    graph_w = width-3*margin;
    canvas.parent("market_graph");
    textAlign(CENTER, CENTER);
    setInterval(update_graph, 60000);
    update_graph();
}

function draw() {
    if(graph){
        push();
        image(graph, 0, 0);
        translate(0, 10);
        stroke(255);
        strokeWeight(2);
        let X = min(graph_w, max(0, mouseX-2*margin));
        let c = floor(map(X, 0, graph_w, 0, maxCap));
        X += 2*margin;
        line(X, 0, X, graph_h);
        push();
        translate(X, 0);
        let tx = -180;
        let ty = mouseY;
        translate(tx, ty);
        noStroke();
        fill_alt = 1;
        for(let i=0; i<supply["price"].length; i++){
            if(supply["cumul_capacities"][i] > c){
                alternate_fill();
                rect(0, 0, 160, 17);
                fill(0);
                textStyle(BOLD);
                text(supply["player"][i],80, 9);
                textStyle(NORMAL);

                translate(0, 16);
                alternate_fill();
                rect(0, 0, 160, 17);
                fill(0);
                text("capacity :", 40, 10);
                text(supply["capacity"][i], 120, 10);

                translate(0, 16);
                alternate_fill();
                rect(0, 0, 160, 17);
                fill(0);
                text("price :", 40, 10);
                text(supply["price"][i], 120, 10);
                break;
            }
        }
        pop();
        pop();
    }
}

function update_graph(){
    fetch(`/get_market_data`) // retrieves data from server
    .then((response) => response.json())
    .then((raw_data) => {
        supply = raw_data["capacities"];
        demand = raw_data["demands"];
        maxCap = max(supply["cumul_capacities"][supply["cumul_capacities"].length-1],
            demand["cumul_capacities"][demand["cumul_capacities"].length-1], 100);
        maxPrice = max(...supply["price"], ...demand["price"], 1/1.1)*1.1;
        minPrice = min(...supply["price"], ...demand["price"], 0)*1.1;
        let f = maxPrice/(maxPrice-minPrice);
        background(229, 217, 182);
        push();
        translate(2*margin, height-margin-10-graph_h*(1-f));
        noStroke();
        push();
        for(i = 0; i<supply["capacity"].length; i++){
            let w = map(supply["capacity"][i], 0, maxCap, 0, graph_w);
            let h = map(supply["price"][i], 0, maxPrice, 0, -graph_h*f);
            fill(cols_and_names[supply["plant"][i]][0])
            rect(0, 0, w, h);
            translate(w, 0);
        }
        pop();
        
        push();
        stroke(255, 0, 0);
        strokeWeight(3);
        for(i = 0; i<demand["capacity"].length; i++){
            let w = map(demand["capacity"][i], 0, maxCap, 0, graph_w);
            h = calc_h(demand["price"][i], f)
            let h2 = 0;
            if (i+1 < demand["capacity"].length){
                h2 = calc_h(demand["price"][i+1], f)
            }
            line(0, h, w, h);
            line(w, h, w, h2);
            translate(w, 0);
        }
        pop();

        stroke(0);
        line(0, 0, graph_w, 0);
        line(0, (1-f)*graph_h, 0, -graph_h*f);

        push();
        let interval = units(maxCap);
        fill(0);
        let x = map(interval, 0, maxCap, 0, graph_w);
        for(let i=x; i<=graph_w; i+=x){
            stroke(0, 0, 0, 30);
            line(i, -graph_h*f, i, (1-f)*graph_h);
            stroke(0);
            line(i, 0, i, 5);
            noStroke();
            text(display_Wh(interval*i/x), i, 0.5*margin);
        }
        pop();

        push(); 
        interval = units(maxPrice-minPrice);
        fill(0);
        let y = map(interval, 0, maxPrice, 0, graph_h*f);
        for(let i=0; i<=graph_h*f; i+=y){
            stroke(0, 0, 0, 30);
            line(graph_w, -i, 0, -i);
            stroke(0);
            line(0, -i, -5, -i);
            noStroke();
            text(display_CHF(interval*i/y),-0.9*margin, -i);
        }
        pop();

        pop();
        graph = get();
    })
    .catch((error) => {
        console.error("Error:", error);
    });
}

function display_Wh(energy) {
    const units = [" Wh", " kWh", " MWh", " GWh", " TWh"];
    return general_format(energy, units);
}

function display_CHF(price) {
    const units = [" CHF", "k CHF", "M CHF", "Md CHF"];
    return general_format(price, units);
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

function alternate_fill(){
    if(fill_alt == 1){
        fill_alt = 0;
        fill(214, 199, 154);
    }else{
        fill_alt = 1;
        fill(229, 217, 182);
    }
}

function units(maxNumber){
    let interval = Math.floor(maxNumber / 5);
    const orderOfMagnitude = Math.floor(Math.log10(interval));
    const firstDigit = Math.floor(interval / 10 ** orderOfMagnitude);
    interval = firstDigit * 10 ** orderOfMagnitude;
    return interval;
}

function calc_h(price, f){
    if(price==null){
        return -2*graph_h;
    }else{
        return map(price, 0, maxPrice, 0, -graph_h*f);
    }
}
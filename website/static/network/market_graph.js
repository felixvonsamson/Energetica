let buttons = [];

let margin = 40;
let graph_h, graph_w;
let demand, supply;
let mq, mp;
let maxPrice;
let minPrice;
let maxCap;
let f;
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
        translate(X, graph_h*f);
        noStroke();
        push();
        fill_alt = 1;
        for(let i=0; i<supply["price"].length; i++){
            if(supply["cumul_capacities"][i] > c){
                fill(255);
                let h = map(supply["price"][i], 0, maxPrice, 0, graph_h*f)
                translate(0, -h);
                ellipse(0, 0, 8, 8);

                let tx = -150;
                let ty = 4;
                if(X - 2*margin < 150){
                    tx = 20;
                }
                if(-h+100 > graph_h*(1-f)){
                    ty = graph_h*(1-f) + h - 120;
                }
                translate(tx, ty);

                for(let j=0; j<5; j++){
                    translate(0, 16);
                    alternate_fill();
                    rect(0, 0, 130, 17);
                }
                translate(0, -16*4);
                fill(0);
                textStyle(BOLD);
                text("Supply",65, 8);
                textStyle(NORMAL);
                textAlign(LEFT);
                let left = ["Player", "Capacity", "Price", "Plant"];
                for(let j of left){
                    translate(0, 16);
                    text(j, 5, 8);
                }
                translate(0, -16*3);
                textAlign(CENTER);
                textStyle(BOLD);
                text(supply["player"][i], 90, 8);
                textStyle(NORMAL);
                let right = [display_Wh(supply["capacity"][i]), display_CHF(supply["price"][i]), cols_and_names[supply["plant"][i]][1]];
                for(let j of right){
                    translate(0, 16);
                    text(j, 90, 8);
                }
                break;
            }
        }
        pop();
        fill_alt = 1;
        let ox = map(mq, 0, maxCap, 0, graph_w);
        let oy = map(mp, 0, maxPrice, 0, graph_h*f);
        if(abs(X - ox - 2*margin) < 30){
            push();
            translate(ox - X + 2*margin - 140, -oy - 74);
            for(let j=0; j<3; j++){
                translate(0, 16);
                alternate_fill();
                rect(0, 0, 130, 17);
            }
            translate(0, -2*16);
            fill(0);
            textStyle(BOLD);
            text("Market optimum",65, 8);
            textStyle(NORMAL);
            textAlign(LEFT);
            translate(0, 16);
            text("Price", 5, 8);
            translate(0, 16);
            text("Quantity", 5, 8);
            textAlign(CENTER);
            translate(0, -16);
            text(display_CHF(mp), 90, 8);
            translate(0, 16);
            text(display_Wh(mq), 90, 8);
            pop();
        }
        push();
        fill_alt = 1;
        for(let i=0; i<demand["price"].length; i++){
            if(demand["cumul_capacities"][i] > c){
                fill(255);
                let h = 2*graph_h;
                let price = "Infinite";
                let plant = "Base demand"
                if (demand["price"][i] != null){
                    h = map(demand["price"][i], 0, maxPrice, 0, graph_h*f);
                    price = display_CHF(demand["price"][i]);
                    plant = cols_and_names[demand["plant"][i]][1];
                }
                translate(0, -h);
                ellipse(0, 0, 8, 8);

                let tx = 20;
                let ty = 4;
                if(width-X < 150){
                    tx = -150;
                }
                if(-h+100 > graph_h*(1-f)){
                    ty = graph_h*(1-f) + h - 120;
                }else if(h > graph_h*f){
                    ty = h - graph_h*f;
                }
                translate(tx, ty);

                for(let j=0; j<5; j++){
                    translate(0, 16);
                    alternate_fill();
                    rect(0, 0, 130, 17);
                }
                translate(0, -16*4);
                fill(0);
                textStyle(BOLD);
                text("Demand",65, 8);
                textStyle(NORMAL);
                textAlign(LEFT);
                let left = ["Player", "Capacity", "Price", "Plant"];
                for(let j of left){
                    translate(0, 16);
                    text(j, 5, 8);
                }
                translate(0, -16*3);
                textAlign(CENTER);
                textStyle(BOLD);
                text(demand["player"][i], 90, 8);
                textStyle(NORMAL);
                let right = [display_Wh(demand["capacity"][i]), price, plant];
                for(let j of right){
                    translate(0, 16);
                    text(j, 90, 8);
                }
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
        mq = raw_data["market_quantity"];
        mp = raw_data["market_price"];
        console.log(mq, mp);
        maxCap = max(supply["cumul_capacities"][supply["cumul_capacities"].length-1],
            demand["cumul_capacities"][demand["cumul_capacities"].length-1], 100);
        maxPrice = max(...supply["price"], ...demand["price"], 1/1.1)*1.1;
        minPrice = min(...supply["price"], ...demand["price"], 0)*1.1;
        f = maxPrice/(maxPrice-minPrice);
        background(229, 217, 182);
        push();
        translate(2*margin, height-margin-10-graph_h*(1-f));
        noStroke();
        push();
        for(i = 0; i<supply["capacity"].length; i++){
            let w = map(supply["capacity"][i], 0, maxCap, 0, graph_w);
            let h = map(supply["price"][i], 0, maxPrice, 0, -graph_h*f);
            fill(cols_and_names[supply["plant"][i]][0])
            rect(0, 0, w-1, h);
            translate(w, 0);
        }
        pop();
        
        push();
        stroke(255, 0, 0);
        strokeWeight(3);
        for(i = 0; i<demand["capacity"].length; i++){
            let w = map(demand["capacity"][i], 0, maxCap, 0, graph_w);
            h = calc_h(demand["price"][i])
            let h2 = 0;
            if (i+1 < demand["capacity"].length){
                h2 = calc_h(demand["price"][i+1])
            }
            line(0, h, w, h);
            line(w, h, w, h2);
            push();
            strokeWeight(0.3);
            line(w, h2, w, 0);
            pop();
            translate(w, 0);
        }
        pop();
        let ox = map(mq, 0, maxCap, 0, graph_w);
        let oy = map(mp, 0, maxPrice, 0, graph_h*f);
        fill(255, 0, 0);
        ellipse(ox, -oy, 10, 10);

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

function calc_h(price){
    if(price==null){
        return -2*graph_h;
    }else{
        return map(price, 0, maxPrice, 0, -graph_h*f);
    }
}
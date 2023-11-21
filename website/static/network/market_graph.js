let buttons = [];

let margin = 40;
let t=0;
let t_view;
let graph_h, graph_w;
let demand, supply;
let mq, mp;
let maxPrice;
let minPrice;
let maxCap;
let f;
let graph;
let fill_alt = 0;

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

function preload() {
    font = loadFont('static/fonts/Baloo2-VariableFont_wght.ttf');
    coin = loadImage('static/images/icons/coin.svg');
}

function setup() {
    cols_and_names = {
        "watermill": [color(40, 145, 201), "Watermill"],
        "small_water_dam": [color(12, 64, 237), "Water dam (S)"],
        "large_water_dam": [color(15, 0, 153), "Water dam (L)"],
        "nuclear_reactor": [color(232, 181, 28), "Nuclear reactor"],
        "nuclear_reactor_gen4": [color(255, 220, 66), "Gen 4 Nuclear"],
        "steam_engine": [color(140, 140, 140), "Steam engine"],
        "coal_burner": [color(0, 0, 0), "Coal burner"],
        "oil_burner": [color(69, 69, 69), "Oil burner"],
        "gas_burner": [color(179, 189, 201), "Gas burner"],
        "combined_cycle": [color(89, 150, 142), "Combined cycle"],
        "windmill": [color(148, 234, 255), "Windmill"],
        "onshore_wind_turbine": [color(44, 239, 242), "Wind onshore"],
        "offshore_wind_turbine": [color(0, 196, 199), "Wind offshore"],
        "CSP_solar": [color(237, 194, 0), "CSP solar"],
        "PV_solar": [color(255, 250, 0), "PV solar"],
        
        "small_pumped_hydro": [color(12, 64, 237), "Hydrostrg. (S)"],
        "large_pumped_hydro": [color(15, 0, 153), "Hydrostrg. (L)"],
        "lithium_ion_batteries": [color(184, 214, 64), "Li-ion batteries"],
        "solid_state_batteries": [color(136, 255, 0), "SS batteries"],
        "compressed_air": [color(201, 160, 219), "Compr. air"],
        "molten_salt": [color(161, 116, 50), "Molten salt"],
        "hydrogen_storage": [color(29, 240, 226), "Hydrolysis"],

        "price": [color(40, 84, 48), "Market price"],
        "quantity": [color(45, 53, 166), "Market quantity"],
    }
  
    let canvas = createCanvas(1200, 1150);
    graph_h = height-margin-500;
    graph_w = width-3*margin;
    canvas.parent("market_graph");
    textAlign(CENTER, CENTER);
    textFont(font);
    for (let i = 0; i < resolution.length; i++) {
        buttons[i] = new Button(resolution[i]);
      }
    buttons[0].active = true;
    setInterval(update_graph, 5000);
    update_graph();
}

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
        stroke(0);
        rect(0, 0, graph_w/resolution.length, margin);
        fill(0);
        textSize(20);
        textAlign(CENTER, CENTER);
        noStroke();
        text(this.res, 0.5*graph_w/resolution.length, 0.5*margin-5);
        pop();
    }
}

function draw() {
    if(graph){
        image(graph, 0, 0);
        push();
        stroke(255);
        strokeWeight(2);
        let mar = 2*margin;
        if (mouseY < 400){
            mar = 1.5*margin
        }
        let X = Math.min(graph_w, Math.max(0, mouseX-mar));
        if(mouseY < 400){
            push();
            fill_alt = 1;
            translate(0, 10);
            push();
            stroke(255);
            strokeWeight(2);
            t_view = floor(map(X, 0, graph_w, 0, data_len-1));
            X += mar;
            line(X, 0, X, 300);
            noStroke();
            translate(X, 300*f);
            for (const key of ["price", "quantity"]) {
                let h = -data[key][t_view]/max[key]*300*f;
                ellipse(0, h, 8, 8);
            }
            let tx = -180;
            let ty = 310-mouseY;
            if(ty<5*16){
                ty = 5*16+2;
            }else if(ty>300){
                ty = graph_h;
            }
            if(t_view/data_len < 180/graph_w){
                tx = 20;
            }
            translate(tx, -ty);
            alternate_fill();
            fill_alt = 0;
            rect(0, 0, 160, 17);
            fill(0);
            textStyle(BOLD);
            text(display_duration((data_len-t_view-1)*res_to_data[res][1]),80, 5);
            textStyle(NORMAL);
            for (const key of ["price", "quantity"]) {
                alternate_fill();
                translate(0, 16);
                rect(0, 0, 160, 17);
                push();
                fill(cols_and_names[key][0]);
                rect(0, 0, 16, 17);
                pop();
                fill(0);
                textAlign(LEFT, CENTER);
                text(cols_and_names[key][1], 20, 5);
                if(key == "price"){
                    textAlign(RIGHT, CENTER);
                    text(display_money(data[key][t_view]), 137, 5);
                    image(coin, 140, 2, 12, 12);
                }else{
                    textAlign(CENTER, CENTER);
                    text(display_W(data[key][t_view]), 132, 5);
                }
                fill(229, 217, 182);
            }
            translate(0, 16);
            if((data_len-t_view-1)*res_to_data[res][1] < 1440){
                fill(0);
                text("(click to see market)", 80, 5);
            }
            pop();
            pop();
        }else if(supply != null){
            translate(0, height-margin-10-graph_h);
            let c = floor(map(X, 0, graph_w, 0, maxCap));
            X += mar;
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
                    text("Supply",65, 4);
                    textStyle(NORMAL);
                    textAlign(LEFT);
                    let left = ["Player", "Capacity", "Price", "Plant"];
                    for(let j of left){
                        translate(0, 16);
                        text(j, 5, 4);
                    }
                    translate(0, -16*3);
                    textAlign(CENTER);
                    textStyle(BOLD);
                    text(supply["player"][i], 90, 4);
                    textStyle(NORMAL);
                    push();
                    textAlign(RIGHT, CENTER);
                    text(display_money(supply["price"][i]), 97, 32+5);
                    image(coin, 100, 32+2, 12, 12);
                    pop();
                    let right = [display_W(supply["capacity"][i]), "", cols_and_names[supply["plant"][i]][1]];
                    for(let j of right){
                        translate(0, 16);
                        text(j, 90, 4);
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
                text("Market optimum",65, 4);
                textStyle(NORMAL);
                textAlign(LEFT);
                translate(0, 16);
                text("Price", 5, 4);
                translate(0, 16);
                text("Quantity", 5, 4);
                textAlign(CENTER);
                translate(0, -16);
                push();
                textAlign(RIGHT, CENTER);
                text(display_money(mp), 97, 5);
                image(coin, 100, 2, 12, 12);
                pop();
                translate(0, 16);
                text(display_W(mq), 90, 4);
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
                        price = display_money(demand["price"][i]);
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
                    text("Demand",65, 4);
                    textStyle(NORMAL);
                    textAlign(LEFT);
                    let left = ["Player", "Capacity", "Price", "Plant"];
                    for(let j of left){
                        translate(0, 16);
                        text(j, 5, 4);
                    }
                    translate(0, -16*3);
                    textAlign(CENTER);
                    textStyle(BOLD);
                    text(demand["player"][i], 90, 4);
                    textStyle(NORMAL);
                    push();
                    textAlign(RIGHT, CENTER);
                    text(price, 97, 32+5);
                    image(coin, 100, 32+2, 12, 12);
                    pop();
                    let right = [display_W(demand["capacity"][i]), "", plant];
                    for(let j of right){
                        translate(0, 16);
                        text(j, 90, 4);
                    }
                    break;
                }
            }
            pop();
        }
        pop();
    }
}

function mousePressed(){
    if(mouseY>350 & mouseY<350+margin & mouseX>1.5*margin & mouseX<graph_w+1.5*margin){
        let i = floor((mouseX-1.5*margin)*buttons.length/graph_w);
        for(let j = 0; j<buttons.length; j++){
            buttons[j].active = false;
        }
        buttons[i].active = true;
        res = buttons[i].res;
        update_graph();
        return
    }
    if (mouseY<350){
        t = (data_len-t_view-1)*res_to_data[res][1];
        update_graph();
    }
}

function update_graph(){
    file = res_to_data[res][0]
    fetch(`/get_market_data?timescale=${file}&t=${t}`) // retrieves data from server
    .then((response) => response.json())
    .then((raw_data) => {
        strokeWeight(1);
        background(229, 217, 182);
        if(raw_data[1] != null){
            supply = raw_data[1]["capacities"];
            demand = raw_data[1]["demands"];
            mq = raw_data[1]["market_quantity"];
            mp = raw_data[1]["market_price"];
            maxCap = Math.max(...supply["cumul_capacities"],
                ...demand["cumul_capacities"], 100);
            maxPrice = Math.max(...supply["price"], ...demand["price"], 1/1.1)*1.1;
            minPrice = Math.min(...supply["price"], ...demand["price"], 0)*1.1;
            f = maxPrice/(maxPrice-minPrice);
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
            let interval = y_units_market(maxCap);
            fill(0);
            let x = map(interval, 0, maxCap, 0, graph_w);
            for(let i=x; i<=graph_w; i+=x){
                stroke(0, 0, 0, 30);
                line(i, -graph_h*f, i, (1-f)*graph_h);
                stroke(0);
                line(i, 0, i, 5);
                noStroke();
                text(display_W(interval*i/x), i, 0.5*margin-3);
            }
            pop();

            push(); 
            interval = y_units_market(maxPrice-minPrice);
            fill(0);
            let y = map(interval, 0, maxPrice, 0, graph_h*f);
            textAlign(RIGHT, CENTER);
            for(let i=0; i<=graph_h*f; i+=y){
                stroke(0, 0, 0, 30);
                line(graph_w, -i, 0, -i);
                stroke(0);
                line(0, -i, -5, -i);
                noStroke();
                image(coin,-25, -i-6,12, 12);
                text(display_money(interval*i/y),-28, -i-3);
            }
            pop();
            pop();
        }else{
            supply = null;
        }

        push();
        fill(229, 217, 182);
        noStroke();
        rect(0, 0, width, 480);
        fill(0);
        textSize(30);
        text("Market : "+display_time(t), width/2, 450-7)
        pop();
        data = raw_data[2];
        Object.keys(data).forEach(key => {
            const array = raw_data[3][key];
            data[key] = reduce(data[key], array, res, raw_data[0]);
            });
        data_len = data["price"].length;
        push();
        translate(1.5*margin, 300*f+10);
        noStroke();
        push();
        strokeWeight(3);
        min = {
            "price": Math.min(0, ...data["price"]),
            "quantity": 0
        }
        max = {
            "price": Math.max(...data["price"], -min["price"]),
            "quantity": Math.max(...data["quantity"])
        }
        f = max["price"] / (max["price"]-min["price"])
        for (const key of ["price", "quantity"]) { 
            stroke(cols_and_names[key][0]);
            push();
            for(let t = 1; t < data_len; t++){
                let h1 = data[key][t-1]/max[key]*300*f;
                let h2 = data[key][t]/max[key]*300*f;
                line(0, -h1, graph_w/data_len, -h2);
                translate(graph_w/(data_len-1), 0);
            }
            pop();
        }
        pop();
        stroke(0);
        line(0, 0, graph_w, 0);
        line(0, 300*(1-f), 0, -300*f);
        line(graph_w, 300*(1-f), graph_w, -300*f);
        
        push();
        let units = time_unit(res);
        fill(0);
        for(let i=0; i<units.length; i++){
            stroke(0, 0, 0, 30);
            let x = i*graph_w/(units.length-1);
            line(x, -300*f, x, 300*(1-f));
            stroke(0);
            line(x, 300*(1-f), x, 300*(1-f)+5);
            noStroke();
            text(units[i], x, 0.5*margin-3);
        }
        pop();

        push();
        let y_ticks = y_units(max["price"]);
        let interval2 = y_ticks[1];
        fill(40, 84, 48);
        let y2 = map(interval2, 0, max["price"], 0, 300*f);
        textAlign(RIGHT, CENTER);
        for(let i=0; i<y_ticks.length; i++){
            stroke(0, 0, 0, 30);
            line(graph_w, -y2*i, 0, -y2*i);
            stroke(40, 84, 48);
            line(0, -y2*i, -5, -y2*i);
            noStroke();
            image(coin,-25, -y2*i-6,12, 12);
            text(display_money(y_ticks[i]),-28, -y2*i-3);
        }
        pop();

        push();
        let y_ticks3 = y_units(max["quantity"]);
        let interval3 = y_ticks3[1];
        fill(45, 53, 166);
        let y3 = map(interval3, 0, max["quantity"], 0, 300*f);
        for(let i=0; i<y_ticks3.length; i++){
            stroke(45, 53, 166);
            line(graph_w, -y3*i, graph_w+5, -y3*i);
            noStroke();
            text(display_W(y_ticks3[i]),graph_w+0.75*margin, -y3*i-3);
        }
        pop();

        pop();
        for(let i = 0; i<buttons.length; i++){
            push();
            translate(1.5*margin + i*graph_w/buttons.length, 350);
            buttons[i].display_button();
            pop();
        }
        graph = get();
    })
    .catch((error) => {
        console.error("Error:", error);
    });
}

function display_W(energy) {
    const units = [" W", " kW", " MW", " GW", " TW"];
    return general_format(energy, units);
}

function display_money(price) {
    const units = ["", "k", "M", "Md"];
    return general_format(price, units);
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

function display_time(minutes) {
    if(minutes == 0){
        return "Now";
    }
    const days = Math.floor(minutes / 1440);
    minutes -= days * 1440;
    const hours = Math.floor(minutes / 60);
    minutes -= hours * 60;

    let duration = "";
    if (days > 0) {
        duration += `${days}days `;
    }
    if (hours > 0) {
        duration += `${hours}h `;
    }
    if (minutes > 0) {
        duration += `${minutes}min`;
    }
    duration += " ago"
    return duration.trim();
}

function general_format(value, units){
    let unit_index = 0;
    while (value >= 10000 && unit_index < units.length - 1) {
        value /= 1000;
        unit_index += 1;
    }
    return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
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

function calc_h(price){
    if(price==null){
        return -2*graph_h;
    }else{
        return map(price, 0, maxPrice, 0, -graph_h*f);
    }
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
    let interval = Math.floor(maxNumber / 3);
    const orderOfMagnitude = Math.floor(Math.log10(interval));
    const firstDigit = Math.floor(interval / 10 ** orderOfMagnitude);
    interval = firstDigit * 10 ** orderOfMagnitude;
    let values = [];
    for (let i = 0; i <= maxNumber; i += interval) {
        values.push(i);
    }
    return values;
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

function y_units_market(maxNumber){
    let interval = Math.floor(maxNumber / 5);
    const orderOfMagnitude = Math.floor(Math.log10(interval));
    const firstDigit = Math.floor(interval / 10 ** orderOfMagnitude);
    interval = firstDigit * 10 ** orderOfMagnitude;
    return interval;
}
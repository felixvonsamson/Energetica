let buttons = [];
let data = {"network_data": {}, "exports": {}, "imports": {}};

let margin = 40;
let t = 0;
let t_view;
let graph_h, graph_w;
let demand, supply;
let mp, mq;
let exports, imports;
let maxPrice;
let minPrice;
let maxCap;
let f1, f2;
let graph;
let fill_alt = 0;
let players = {};

let resolution;
let res;
let view = "exports";
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
        "×6": 6,
        "×36": 36,
        "×216": 216,
        "×1296": 1296,
    };
}

let cols_and_names = {};
let random_colors = [];

function preload() {
    font = loadFont("static/fonts/Baloo2-VariableFont_wght.ttf");
    balooBold = loadFont("static/fonts/Baloo2-SemiBold.ttf");
    coin = loadImage("static/images/icons/coin.svg");
}

function setup() {
    random_colors = [
        color(166,206,227),
        color(31,120,180),
        color(178,223,138),
        color(51,160,44),
        color(251,154,153),
        color(227,26,28),
        color(253,191,111),
        color(255,127,0),
        color(202,178,214),
        color(106,61,154),
        color(255,255,153),
        color(177,89,40),
    ];
    cols_and_names = {
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

        coal_mine: [color(73, 80, 87), "Coal mines"],
        oil_field: [color(181, 23, 158), "Oil fields"],
        gas_drilling_site: [color(76, 201, 240), "Gas fields"],
        uranium_mine: [color(238, 239, 32), "Uran. mines"],
        industry: [color(188, 108, 37), "Industry"],
        research: [color(255, 255, 255), "Research"],
        construction: [color(255, 123, 0), "Constructions"],
        transport: [color(106, 0, 244), "Shipments"],
        carbon_capture: [color(173, 181, 189), "CO2 capture"],

        price: [color(40, 84, 48), "Market price"],
        quantity: [color(45, 53, 166), "Market quantity"],
    };
    let canvas_width = 0.7 * windowWidth;
    let canvas_height = 0.67 * windowWidth;
    if (windowWidth < 1200) {
        canvas_width = windowWidth;
        canvas_height = 0.96 * windowWidth;
    }
    let canvas = createCanvas(
        min(canvas_width, 1200),
        min(canvas_height, 1150)
    );
    margin = min(40, width / 25);
    graph_h = 0.63 * height - 3 * margin;
    graph_w = width - 3 * margin;
    canvas.parent("market_graph");
    textAlign(CENTER, CENTER);
    textFont(font);
    for (let i = 0; i < resolution.length; i++) {
        buttons[i] = new Button(resolution[i]);
    }
    buttons[0].active = true;
    update_graph();
}

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
        stroke(0);
        rect(0, 0, graph_w / resolution.length, margin);
        fill(0);
        textSize(20);
        textAlign(CENTER, CENTER);
        noStroke();
        text(this.res, (0.5 * graph_w) / resolution.length, 0.5 * margin - 5);
        pop();
    }
}

function draw() {
    if (graph) {
        image(graph, 0, 0);
        push();
        stroke(255);
        strokeWeight(2);
        let mar = 2 * margin;
        if (mouseY < 0.35 * height) {
            mar = 1.5 * margin;
        }
        let X = Math.min(graph_w, Math.max(0, mouseX - mar));
        if (mouseY < 0.35 * height) {
            push();
            fill_alt = 1;
            translate(0, 10);
            push();
            stroke(255);
            strokeWeight(2);
            t_view = floor(map(X, 0, graph_w, 0, data_len - 1));
            X += mar;
            line(X, 0, X, 0.26 * height);
            noStroke();
            translate(X, 0.26 * height * f1);
            for (const key of ["price", "quantity"]) {
                let h = (-data["network_data"][key][t_view] / max[key]) * 0.26 * height * f1;
                ellipse(0, h, 8, 8);
            }
            let tx = -180;
            let ty = 0.27 * height - mouseY;
            if (ty < 4 * 16) {
                ty = 4 * 16 + 2;
            } else if (ty > 0.26 * height) {
                ty = 0.26 * height;
            }
            if (t_view / data_len < 180 / graph_w) {
                tx = 20;
            }
            translate(tx, -ty);
            alternate_fill();
            fill_alt = 0;
            rect(0, 0, 160, 17);
            fill(0);
            textFont(balooBold);
            text(
                display_duration((data_len - t_view - 1) * res_to_factor[res]),
                80,
                5
            );
            textFont(font);
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
                if (key == "price") {
                    textAlign(RIGHT, CENTER);
                    text(display_money(data["network_data"][key][t_view]), 137, 5);
                    image(coin, 140, 2, 12, 12);
                } else {
                    textAlign(CENTER, CENTER);
                    text(display_W(data["network_data"][key][t_view]), 132, 5);
                }
                fill(229, 217, 182);
            }
            translate(0, 16);
            if ((data_len - t_view - 1) * res_to_factor[res] < 1440) {
                fill(0);
                text("(click to see market)", 80, 5);
            }
            pop();
            pop();
        } else if (supply != null) {
            translate(0, height - margin - 10 - graph_h);
            let c = floor(map(X, 0, graph_w, 0, maxCap));
            X += mar;
            line(X, 0, X, graph_h);
            translate(X, graph_h * f2);
            noStroke();
            push();
            fill_alt = 1;
            for (let i = 0; i < supply["price"].length; i++) {
                if (supply["cumul_capacities"][i] > c) {
                    fill(255);
                    let h = map(
                        supply["price"][i],
                        0,
                        maxPrice,
                        0,
                        graph_h * f2
                    );
                    translate(0, -h);
                    ellipse(0, 0, 8, 8);

                    let tx = -150;
                    let ty = 4;
                    if (X - 2 * margin < 150) {
                        tx = 20;
                    }
                    if (-h + 100 > graph_h * (1 - f2)) {
                        ty = graph_h * (1 - f2) + h - 120;
                    }
                    translate(tx, ty);

                    for (let j = 0; j < 5; j++) {
                        translate(0, 16);
                        alternate_fill();
                        rect(0, 0, 130, 17);
                    }
                    translate(0, -16 * 4);
                    fill(0);
                    textFont(balooBold);
                    text("Supply", 65, 4);
                    textFont(font);
                    textAlign(LEFT);
                    let left = ["Player", "Capacity", "Price", "facility"];
                    for (let j of left) {
                        translate(0, 16);
                        text(j, 5, 4);
                    }
                    translate(0, -16 * 3);
                    textAlign(CENTER);
                    textFont(balooBold);
                    let userObject = players[supply["player_id"][i]];
                    let username = userObject
                        ? userObject.username
                        : "Loading...";
                    text(username, 90, 4);
                    textFont(font);
                    push();
                    textAlign(RIGHT, CENTER);
                    text(display_money(supply["price"][i]), 97, 32 + 5);
                    image(coin, 100, 32 + 2, 12, 12);
                    pop();
                    let right = [
                        display_W(supply["capacity"][i]),
                        "",
                        cols_and_names[supply["facility"][i]][1],
                    ];
                    for (let j of right) {
                        translate(0, 16);
                        text(j, 90, 4);
                    }
                    break;
                }
            }
            pop();
            fill_alt = 1;
            let ox = map(mq, 0, maxCap, 0, graph_w);
            let oy = map(mp, 0, maxPrice, 0, graph_h * f2);
            if (abs(X - ox - 2 * margin) < 30) {
                push();
                translate(ox - X + 2 * margin - 140, -oy - 74);
                for (let j = 0; j < 3; j++) {
                    translate(0, 16);
                    alternate_fill();
                    rect(0, 0, 130, 17);
                }
                translate(0, -2 * 16);
                fill(0);
                textFont(balooBold);
                text("Market optimum", 65, 4);
                textFont(font);
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
            for (let i = 0; i < demand["price"].length; i++) {
                if (demand["cumul_capacities"][i] > c) {
                    fill(255);
                    let h = 2 * graph_h;
                    let price = "Infinite";
                    let facility = "Base demand";
                    if (demand["price"][i] != null) {
                        h = map(
                            demand["price"][i],
                            0,
                            maxPrice,
                            0,
                            graph_h * f2
                        );
                        price = display_money(demand["price"][i]);
                        facility = cols_and_names[demand["facility"][i]][1];
                    }
                    translate(0, -h);
                    ellipse(0, 0, 8, 8);

                    let tx = 20;
                    let ty = 4;
                    if (width - X < 150) {
                        tx = -150;
                    }
                    if (-h + 100 > graph_h * (1 - f2)) {
                        ty = graph_h * (1 - f2) + h - 120;
                    } else if (h > graph_h * f2) {
                        ty = h - graph_h * f2;
                    }
                    translate(tx, ty);

                    for (let j = 0; j < 5; j++) {
                        translate(0, 16);
                        alternate_fill();
                        rect(0, 0, 130, 17);
                    }
                    translate(0, -16 * 4);
                    fill(0);
                    textFont(balooBold);
                    text("Demand", 65, 4);
                    textFont(font);
                    textAlign(LEFT);
                    let left = ["Player", "Capacity", "Price", "facility"];
                    for (let j of left) {
                        translate(0, 16);
                        text(j, 5, 4);
                    }
                    translate(0, -16 * 3);
                    textAlign(CENTER);
                    textFont(balooBold);
                    let userObject = players[demand["player_id"][i]];
                    let username = userObject
                        ? userObject.username
                        : "Loading...";
                    text(username, 90, 4);
                    textFont(font);
                    push();
                    textAlign(RIGHT, CENTER);
                    text(price, 97, 32 + 5);
                    image(coin, 100, 32 + 2, 12, 12);
                    pop();
                    let right = [
                        display_W(demand["capacity"][i]),
                        "",
                        facility,
                    ];
                    for (let j of right) {
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

function mousePressed() {
    if (
        (mouseY > 0.33 * height) &
        (mouseY < 0.33 * height + margin) &
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
        return;
    }
    if (
        (mouseY > 0.3 * height) &
        (mouseY < 0.33 * height) &
        (mouseX > width - 1.5 * margin - 160) &
        (mouseX < width - 1.5 * margin)
    ) {
        let i = floor((mouseX - width + 1.5 * margin + 160)/ 80);
        if (i == 0) {
            view = "exports";
        } else {  
            view = "imports";
        }
        update_graph();
        return;
    }
    if (mouseY < 0.32 * height) {
        t = (data_len - t_view - 1) * res_to_factor[res];
        update_graph();
    }
}

function update_graph() {
    load_chart_data((network = true)).then((raw_chart_data) => {
        fetch(`/api/get_market_data?t=${t}`) // retrieves data from server
            .then((response) => response.json())
            .then((raw_data) => {
                strokeWeight(1);
                background(229, 217, 182);
                if (raw_data != null) {
                    supply = raw_data["capacities"];
                    demand = raw_data["demands"];
                    mq = raw_data["market_quantity"];
                    mp = raw_data["market_price"];
                    maxCap = Math.max(
                        ...supply["cumul_capacities"],
                        ...demand["cumul_capacities"],
                        100
                    );
                    maxPrice =
                        Math.max(...supply["price"], ...demand["price"], 1 / 1.1) *
                        1.1;
                    minPrice =
                        Math.min(...supply["price"], ...demand["price"], 0) * 1.1;
                    f2 = maxPrice / (maxPrice - minPrice);
                    push();
                    translate(
                        2 * margin,
                        height - margin - 10 - graph_h * (1 - f2)
                    );
                    noStroke();
                    push();
                    for (i = 0; i < supply["capacity"].length; i++) {
                        let w = map(supply["capacity"][i], 0, maxCap, 0, graph_w);
                        let h = map(
                            supply["price"][i],
                            0,
                            maxPrice,
                            0,
                            -graph_h * f2
                        );
                        if (h < 0) {
                            h = Math.min(h, -3);
                        }
                        if (h > 0) {
                            h = Math.max(h, 3);
                        }
                        fill(cols_and_names[supply["facility"][i]][0]);
                        rect(0, 0, w - 1, h);
                        translate(w, 0);
                    }
                    pop();

                    push();
                    stroke(255, 0, 0);
                    strokeWeight(3);
                    for (i = 0; i < demand["capacity"].length; i++) {
                        let w = map(demand["capacity"][i], 0, maxCap, 0, graph_w);
                        h = calc_h(demand["price"][i]);
                        let h2 = 0;
                        if (i + 1 < demand["capacity"].length) {
                            h2 = calc_h(demand["price"][i + 1]);
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
                    let oy = map(mp, 0, maxPrice, 0, graph_h * f2);
                    fill(255, 0, 0);
                    ellipse(ox, -oy, 10, 10);

                    stroke(0);
                    line(0, 0, graph_w, 0);
                    line(0, (1 - f2) * graph_h, 0, -graph_h * f2);

                    push();
                    let interval = y_units_market(maxCap);
                    fill(0);
                    let x = map(interval, 0, maxCap, 0, graph_w);
                    for (let i = x; i <= graph_w; i += x) {
                        stroke(0, 0, 0, 30);
                        line(i, -graph_h * f2, i, (1 - f2) * graph_h);
                        stroke(0);
                        line(i, 0, i, 5);
                        noStroke();
                        text(display_W((interval * i) / x), i, 0.5 * margin - 3);
                    }
                    pop();

                    push();
                    interval = y_units_market(maxPrice - minPrice);
                    fill(0);
                    let y = map(interval, 0, maxPrice, 0, graph_h * f2);
                    textAlign(RIGHT, CENTER);
                    for (let i = 0; i <= graph_h * f2; i += y) {
                        stroke(0, 0, 0, 30);
                        line(graph_w, -i, 0, -i);
                        stroke(0);
                        line(0, -i, -5, -i);
                        noStroke();
                        image(coin, -25, -i - 6, 12, 12);
                        text(display_money((interval * i) / y), -28, -i - 3);
                    }
                    pop();
                    pop();
                } else {
                    supply = null;
                }

                push();
                fill(229, 217, 182);
                noStroke();
                rect(0, 0, width, 0.4 * height);
                fill(0);
                textSize(30);
                text("Market : " + display_time(t), width / 2, 0.39 * height);
                pop();
            
                Object.keys(raw_chart_data).forEach((key) => {
                    Object.keys(raw_chart_data[key]).forEach((subkey) => {
                        data[key][subkey] = reduce(raw_chart_data[key][subkey], res);
                    });
                });
                data_len = data["network_data"]["price"].length;
                min = {
                    price: Math.min(0, ...data["network_data"]["price"]),
                    quantity: 0,
                };
                max = {
                    price: Math.max(...data["network_data"]["price"], -min["price"]),
                    quantity: Math.max(...data["network_data"]["quantity"]),
                };
                f1 = max["price"] / (max["price"] - min["price"]);
                push();
                translate(1.5 * margin, 0.26 * height * f1 + 10);
                noStroke();
                push();
                for (let t = 0; t < data_len; t++) {
                    push();
                    for (const player_id in data[view]) {
                        fill(random_colors[player_id % random_colors.length]);
                        let h = (data[view][player_id][t] / max["quantity"]) * 0.26 * height * f1;
                        rect(0, 0, graph_w / data_len + 1, -h - 1);
                        translate(0, -h);
                    }
                    pop();
                    translate(graph_w / data_len, 0);
                }
                pop();
                push();
                strokeWeight(3);
                stroke(cols_and_names["price"][0]);
                for (let t = 1; t < data_len; t++) {
                    let h1 =
                        (data["network_data"]["price"][t - 1] / max["price"]) * 0.26 * height * f1;
                    let h2 = (data["network_data"]["price"][t] / max["price"]) * 0.26 * height * f1;
                    line(0, -h1, graph_w / data_len, -h2);
                    translate(graph_w / (data_len - 1), 0);
                }
                pop();
                stroke(0);
                line(0, 0, graph_w, 0);
                line(0, 0.26 * height * (1 - f1), 0, -0.26 * height * f1);
                line(
                    graph_w,
                    0.26 * height * (1 - f1),
                    graph_w,
                    -0.26 * height * f1
                );

                push();
                let units = time_unit(res, clock_time);
                fill(0);
                for (let i = 0; i < units.length; i++) {
                    stroke(0, 0, 0, 30);
                    let x = (i * graph_w) / (units.length - 1);
                    line(x, -0.26 * height * f1, x, 0.26 * height * (1 - f1));
                    stroke(0);
                    line(
                        x,
                        0.26 * height * (1 - f1),
                        x,
                        0.26 * height * (1 - f1) + 5
                    );
                    noStroke();
                    text(units[i], x, 0.5 * margin - 3);
                }
                pop();

                push();
                let y_ticks = y_units(max["price"]);
                let interval2 = y_ticks[1];
                fill(40, 84, 48);
                let y2 = map(interval2, 0, max["price"], 0, 0.26 * height * f1);
                textAlign(RIGHT, CENTER);
                for (let i = 0; i < y_ticks.length; i++) {
                    stroke(0, 0, 0, 30);
                    line(graph_w, -y2 * i, 0, -y2 * i);
                    stroke(40, 84, 48);
                    line(0, -y2 * i, -5, -y2 * i);
                    noStroke();
                    image(coin, -25, -y2 * i - 6, 12, 12);
                    text(display_money(y_ticks[i]), -28, -y2 * i - 3);
                }
                pop();

                push();
                let y_ticks3 = y_units(max["quantity"]);
                let interval3 = y_ticks3[1];
                fill(45, 53, 166);
                let y3 = map(
                    interval3,
                    0,
                    max["quantity"],
                    0,
                    0.26 * height * f1
                );
                for (let i = 0; i < y_ticks3.length; i++) {
                    stroke(45, 53, 166);
                    line(graph_w, -y3 * i, graph_w + 5, -y3 * i);
                    noStroke();
                    text(
                        display_W(y_ticks3[i]),
                        graph_w + 0.75 * margin,
                        -y3 * i - 3
                    );
                }
                pop();

                pop();
                for (let i = 0; i < buttons.length; i++) {
                    push();
                    translate(
                        1.5 * margin + (i * graph_w) / buttons.length,
                        0.33 * height
                    );
                    buttons[i].display_button();
                    pop();
                }

                push();
                translate(width - 1.5 * margin - 160, 0.3 * height);
                if (view == "exports") {
                    fill(220);
                } else {
                    fill(180);
                }
                stroke(0);
                rect(0, 0, 80, 0.7*margin);
                fill(0);
                textSize(18);
                textAlign(CENTER, CENTER);
                noStroke();
                text("exports", 40, 0.35 * margin - 5);
                if (view == "exports") {
                    fill(180);
                } else {
                    fill(220);
                }
                stroke(0);
                rect(80, 0, 80, 0.7*margin);
                fill(0);
                noStroke();
                text("imports", 120, 0.35 * margin - 5);
                pop();

                graph = get();
            });
        })
        .catch((error) => {
            console.error("Error:", error);
        });
    load_players().then((players_) => {
        players = players_;
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

function display_time(ticks) {
    let seconds = ticks * clock_time;
    if (seconds == 0) {
        return "Now";
    }
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    let duration = "";
    if (days > 0) {
        duration += `${days}days `;
    }
    if (hours > 0) {
        duration += `${hours}h `;
    }
    if (minutes > 0) {
        duration += `${minutes}min `;
    }
    if (seconds > 0) {
        duration += `${seconds}s`;
    }
    duration += " ago";
    return duration.trim();
}

function general_format(value, units) {
    let unit_index = 0;
    while (value >= 10000 && unit_index < units.length - 1) {
        value /= 1000;
        unit_index += 1;
    }
    return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
        units[unit_index]
    }`;
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

function calc_h(price) {
    if (price == null) {
        return -2 * graph_h;
    } else {
        return map(price, 0, maxPrice, 0, -graph_h * f2);
    }
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

function y_units_market(maxNumber) {
    let interval = Math.floor(maxNumber / 5);
    const orderOfMagnitude = Math.floor(Math.log10(interval));
    const firstDigit = Math.floor(interval / 10 ** orderOfMagnitude);
    interval = firstDigit * 10 ** orderOfMagnitude;
    return interval;
}

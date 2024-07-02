// data of the temporal graph
let temporal_data = {"network_data": {}, "exports": {}, "imports": {}};
let lower_bounds, upper_bounds;
let price_curve;
let data_len;

// data for the market graph
let demand, supply;
let sqrt_supply_capacities, sqrt_demand_capacities;
let mp, mq; // market optimum price and quantity
let maxPrice, minPrice; // price range
let maxCap, minCap; // capacity range
let maxCap_sqrt_supply, maxCap_sqrt_demand;
let view_market = "supply"; // supply or demand
let market_mode = "log"; // normal log or zoom
let categorisation = "facility"; // facility or player
let ox;

//resolution buttons
let resolution_list;
let res_to_factor;
let res; // current resolution

//styling variables
let margin = 40;
let canvas_width;
let fill_alt = 0;
let s1 = 0.25; // size of first chart
let s2 = 0.25; // size of second chart
let s3 = 0.1; // size of resolution buttons row

let t_view; // hovered timestamp
let t_click = 0; // clicked timestamp

let players = {};

let graph;

if (clock_time == 60){
    resolution_list = ["1h", "6h", "36h", "9 days", "2 months", "year"];
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
    resolution_list = ["30min", "3h", "18h", "4 days", "month", "6 months"];
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
    resolution_list = ["×1 (60)", "×1 (360)", "×6", "×36", "×216", "×1296"];
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

var temporal_graph_p5, market_chart_p5;

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

        price: [color(139, 0, 0), "Market price"],
    };

    canvas_width = 0.7 * windowWidth;
    if (windowWidth < 1200) {
        canvas_width = windowWidth;
    }
    margin = min(70, canvas_width / 10);

    temporal_graph_p5 =  new p5(temporal_graph_sketch, "temporal_graph");
    
    market_chart_p5 = new p5(market_chart_sketch, "market_chart");
 
    fetch_data();
}

function temporal_graph_sketch(s){
    s.setup = function() {
        s.view = "exports";
        s.price_mode = "normal";
        s.percent = "normal";
        s.createCanvas(min(canvas_width, 1200), 0.42 * canvas_width);
        s.noLoop();
        s.textFont(font);
        s.textAlign(CENTER, CENTER);
        s.graphics = s.createGraphics(s.width, s.height);
        s.graphics.textAlign(CENTER, CENTER);
        s.graphics.textFont(font);
    }

    s.draw = function() {
        if (s.graphics_ready) {
            s.image(s.graphics, 0, 0);
            s.push();
            s.stroke(255);
            s.strokeWeight(2);
            let X = min(s.graph_w, max(0, s.mouseX - margin));
            t_view = floor(map(X, 0, s.graph_w, 0, data_len - 1));
            s.translate(margin + X, s.graph_h + 0.4 * margin);
            s.line(0, 0, 0, -s.graph_h);
            s.noStroke();
            if (s.price_mode != "off") {
                s.push();
                s.translate(0, - s.graph_h * (1-s.frac));
                let h = (-price_curve[t_view] / upper_bounds.price) * s.graph_h * s.frac;
                s.ellipse(0, h, 8, 8);
                s.pop();
            }

            s.push();
            let sum = upper_bounds.quantity;
            if(s.percent == "percent"){
                const player_ids = Object.keys(temporal_data[s.view]);
                sum = player_ids.reduce((acc, player_id) => {
                    return acc + (temporal_data[s.view][player_id][res][t_view] || 0);
                }, 0);
            }
            for (const player_id in temporal_data[s.view]) {
                if (temporal_data[s.view][player_id][res][t_view] > 0) {
                    let h = -temporal_data[s.view][player_id][res][t_view] * s.graph_h / sum;
                    s.ellipse(0, h, 8, 8);
                    s.translate(0, h);
                }
            }
            s.pop();
            
            let count = 2 + (s.price_mode != "off");
            for(const player_id in temporal_data[s.view]){
                if(temporal_data[s.view][player_id][res][t_view] > 0){
                    count += 1;
                }
            }
            let tx = -180;
            let ty = - 0.4 * margin - s.graph_h + s.mouseY;
            if (ty > - count * 16) {
                ty = - count * 16;
            }
            if (X < 180) {
                tx = 20;
            }
            s.translate(tx, ty);
            alternate_fill(s);
            fill_alt = 0;
            s.rect(0, 0, 160, 17);
            s.fill(0);
            s.textFont(balooBold);
            s.text(display_duration((data_len - t_view - 1) * res_to_factor[res]), 80, 5);
            s.textFont(font);
            s.translate(0, 16);

            if(s.price_mode != "off"){
                alternate_fill(s);
                s.rect(0, 0, 160, 17);
                s.push();
                s.fill(cols_and_names.price[0]);
                s.rect(0, 0, 16, 17);
                s.pop();
                s.fill(0);
                s.textAlign(LEFT, CENTER);
                s.text(cols_and_names.price[1], 20, 5);
                s.textAlign(RIGHT, CENTER);
                s.text(display_money(price_curve[t_view]), 137, 5);
                s.image(coin, 140, 2, 12, 12);
                s.translate(0, 16);
            }
            
            const keys = Object.keys(temporal_data[s.view]).reverse();
            for(const player_id of keys){
                if(temporal_data[s.view][player_id][res][t_view] > 0){
                    alternate_fill(s);
                    s.rect(0, 0, 160, 17);
                    s.push();
                    s.fill(random_colors[player_id % random_colors.length]);
                    s.rect(0, 0, 16, 17);
                    s.pop();
                    s.fill(0);
                    s.textAlign(LEFT, CENTER);
                    let userObject = players[int(player_id)];
                    let username = userObject ? userObject.username : "Loading...";
                    s.text(username, 20, 5);
                    s.textAlign(CENTER, CENTER);
                    s.text(display_W(temporal_data[s.view][player_id][res][t_view]), 132, 5);
                    s.translate(0, 16);
                }
            }
            if (s.mouseY > 0.4 * margin && s.mouseY < s.height - 0.6 * margin) {
                if ((data_len - t_view - 1) * res_to_factor[res] < 1440) {
                    s.fill(0);
                    s.text("(click to see market)", 80, 5);
                }
            }
            s.pop();
        }
    }

    s.mouseMoved = function() {
        if (s.mouseX>0 && s.mouseX<s.width && s.mouseY>0 && s.mouseY<s.height){
            s.redraw();
        }
    }

    s.mouseDragged = function() {
        s.mouseMoved();
    }

    s.mousePressed = function() {
        if (s.mouseX>0 && s.mouseX<s.width && s.mouseY>0.4*margin && s.mouseY<s.height-0.6*margin){
            if ((data_len - t_view - 1) * res_to_factor[res] < 1440) {
                t_click = (data_len - t_view - 1) * res_to_factor[res];
                document.getElementById("market_time").innerHTML = display_duration(t_click);
                fetch_data();
            }
        }
    }


    s.render_graph = function(){
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin;
        s.graphics.background(229, 217, 182);

        data_len = temporal_data["network_data"]["price"][res].length;
        lower_bounds = {
            price: Math.min(0, ...temporal_data["network_data"]["price"][res]),
            quantity: 0,
        };
        upper_bounds = {
            price: Math.max(...temporal_data["network_data"]["price"][res], -lower_bounds["price"]),
            quantity: Math.max(...temporal_data["network_data"]["quantity"][res]),
        };
        s.frac = upper_bounds["price"] / (upper_bounds["price"] - lower_bounds["price"]); // fraction of negative range in the graph

        s.graphics.push();
        s.graphics.translate(margin, 0.4 * margin + s.graph_h);
        s.graphics.noStroke();

        s.graphics.push();
        for (let t = 0; t < data_len; t++) {
            s.graphics.push();
            let sum = upper_bounds["quantity"];
            if(s.percent == "percent"){
                const player_ids = Object.keys(temporal_data[s.view]);
                sum = player_ids.reduce((acc, player_id) => {
                    return acc + (temporal_data[s.view][player_id][res][t] || 0);
                }, 0);
            }
            for (const player_id in temporal_data[s.view]) {
                if (temporal_data[s.view][player_id][res][t] > 0) {
                    s.graphics.fill(random_colors[player_id % random_colors.length]);
                    let h = temporal_data[s.view][player_id][res][t] * s.graph_h / sum;
                    s.graphics.rect(0, 0, s.graph_w / data_len + 1, -h - 1);
                    s.graphics.translate(0, -h);
                }
            }
            s.graphics.pop();
            s.graphics.translate(s.graph_w / data_len, 0);
        }
        s.graphics.pop();
        
        if(s.price_mode != "off"){
            price_curve = [...temporal_data.network_data.price[res]];
            if (s.price_mode == "smoothed") {
                let window_size = 5;
                // Generate Normalized Gaussian kernel
                let gaussian_kernel = [];
                for (let i = -window_size; i <= window_size; i++) {
                    gaussian_kernel.push(Math.exp(-(i ** 2) / 10));
                }
                
                price_curve = []
                for (let t = 0; t < data_len; t++) {
                    let start = max(0, t - window_size);
                    let end = min(data_len - 1, t + window_size);
                    let sum = 0;
                    let weight_sum = 0;
                    for (let i = start; i <= end; i++) {
                        sum += temporal_data.network_data.price[res][i] * gaussian_kernel[i - t + window_size];
                        weight_sum += gaussian_kernel[i - t + window_size];
                    }
                    price_curve[t] = sum / weight_sum; 
                }
            }
            s.graphics.push();
            s.graphics.translate(0, -s.graph_h * (1 - s.frac));
            s.graphics.strokeWeight(3);
            s.graphics.stroke(cols_and_names["price"][0]);
            for (let t = 1; t < data_len; t++) {
                let h1 = (price_curve[t - 1] / upper_bounds["price"]) * s.graph_h * s.frac;
                let h2 = (price_curve[t] / upper_bounds["price"]) * s.graph_h * s.frac;
                s.graphics.line(0, -h1, s.graph_w / data_len, -h2);
                s.graphics.translate(s.graph_w / (data_len - 1), 0);
            }
            s.graphics.pop();
        }

        s.graphics.stroke(0);
        s.graphics.line(0, 0, s.graph_w, 0);
        s.graphics.line(0, 0, 0, -s.graph_h);
        s.graphics.line(s.graph_w, 0, s.graph_w, -s.graph_h);

        s.graphics.push();
        let units = time_unit(res, clock_time);
        s.graphics.fill(0);
        for (let i = 0; i < units.length; i++) {
            s.graphics.stroke(0, 0, 0, 30);
            let x = (i * s.graph_w) / (units.length - 1);
            s.graphics.line(x, -s.graph_h, x, 0);
            s.graphics.stroke(0);
            s.graphics.line(x, 0, x, 5);
            s.graphics.noStroke();
            s.graphics.text(units[i], x, 0.26 * margin);
        }
        s.graphics.pop();

        if (s.price_mode != "off") {
            s.graphics.push();
            s.graphics.translate(0, -s.graph_h * (1 - s.frac));
            let y_ticks = y_units(upper_bounds["price"]);
            let interval2 = y_ticks[1];
            s.graphics.fill(cols_and_names["price"][0]);
            let y2 = map(interval2, 0, upper_bounds["price"], 0, s.graph_h * s.frac);
            s.graphics.textAlign(RIGHT, CENTER);
            for (let i = 0; i < y_ticks.length; i++) {
                s.graphics.stroke(cols_and_names["price"][0]);
                s.graphics.line(0, -y2 * i, -5, -y2 * i);
                s.graphics.noStroke();
                s.graphics.image(coin, -23, -y2 * i - 6, 12, 12);
                s.graphics.text(display_money(y_ticks[i]), -28, -y2 * i - 3);
            }
            s.graphics.pop();
        }

        s.graphics.push();
        let y_ticks3 = y_units(upper_bounds["quantity"]);
        let interval3 = y_ticks3[1];
        s.graphics.fill(0);
        let y3 = map(interval3, 0, upper_bounds["quantity"], 0, s.graph_h);
        if(s.percent == "percent"){
            y_ticks3 = ["0", "25%", "50%", "75%", "100%"];
            y3 = s.graph_h / 4;
        }
        for (let i = 0; i < y_ticks3.length; i++) {
            s.graphics.stroke(0, 0, 0, 30);
            s.graphics.line(s.graph_w, -y3 * i, 0, -y3 * i);
            s.graphics.stroke(0);
            s.graphics.line(s.graph_w, -y3 * i, s.graph_w + 5, -y3 * i);
            s.graphics.noStroke();
            if(s.percent == "percent"){
                s.graphics.text(y_ticks3[i], s.graph_w + 0.5 * margin, -y3 * i + 3);
            }else{
                s.graphics.text(display_W(y_ticks3[i]), s.graph_w + 0.5 * margin, -y3 * i - 3);
            }
        }
        s.graphics.pop();

        s.graphics.pop();

        s.graphics_ready = true;
        s.redraw();
    } 
}

function market_chart_sketch(s){
    s.setup = function() {
        s.view = "supply";
        s.market_mode = "normal";
        s.categorisation = "facility";
        s.createCanvas(min(canvas_width, 1200), 0.55 * canvas_width);
        s.noLoop();
        s.textFont(font);
        s.textAlign(CENTER, CENTER);
        s.graphics = s.createGraphics(s.width, s.height);
        s.graphics.textAlign(CENTER, CENTER);
        s.graphics.textFont(font);
    }

    s.draw = function() {
        if (s.graphics_ready) {
            s.image(s.graphics, 0, 0);
            s.push();
            s.stroke(255);
            s.strokeWeight(2);
            let X = min(s.graph_w, max(0, s.mouseX - margin));
            s.translate(margin + X, 0.4 * margin + s.graph_h);
            let c = floor(map(X, 0, s.graph_w, minCap, maxCap));
            s.line(0, 0, 0, -s.graph_h);
            s.translate(0, -s.graph_h * (1 - s.frac));
            s.noStroke();
            let h;
            if (s.market_mode == "log") {
                s.push();
                fill_alt = 1;
                let cumul_capacities_sqrt = 0;
                if (s.view == "supply") {
                    for (let i = 0; i < sqrt_supply_capacities.length; i++) {
                        cumul_capacities_sqrt += sqrt_supply_capacities[i];
                        if (cumul_capacities_sqrt / maxCap_sqrt_supply * s.graph_w > X) {
                            s.fill(255);
                            h = map(supply["price"][i], 0, maxPrice, 0, s.graph_h * s.frac);
                            if (h < 0) {
                                h = Math.min(h, -5);
                            }
                            s.translate(0, -h);
                            s.ellipse(0, 0, 8, 8);

                            let tx = -150;
                            let ty = -110;
                            if (X < 150) {
                                tx = 20;
                            }
                            if (h + 110 > s.graph_h * s.frac) {
                                ty = h - s.graph_h * s.frac;
                            }
                            s.translate(tx, ty);

                            display_capacity_information(s, "Supply", supply, i)
                            break;
                        }
                    }
                }else{
                    for (let i = 0; i < sqrt_supply_capacities.length; i++) {
                        cumul_capacities_sqrt += sqrt_supply_capacities[i];
                        if (cumul_capacities_sqrt / maxCap_sqrt_supply * s.graph_w > X) {
                            s.fill(255);
                            h = map(demand["price"][i], 0, maxPrice, 0, s.graph_h * s.frac);
                            s.translate(0, -h);
                            s.ellipse(0, 0, 8, 8);

                            let tx = 20;
                            let ty = -110;
                            if (s.width < X + 150) {
                                tx = -150;
                            }
                            if (h + 110 > s.graph_h * s.frac) {
                                ty = h - s.graph_h * s.frac;
                            }
                            s.translate(tx, ty);

                            display_capacity_information(s, "Demand", demand, i)
                            break;
                        }
                    }
                }
                s.pop();
            }else{
                s.push();
                fill_alt = 1;
                if(s.view == "supply"){
                    for (let i = 0; i < supply["price"].length; i++) {
                        if (supply["cumul_capacities"][i] > c) {
                            s.fill(255);
                            h = map(supply["price"][i], 0, maxPrice, 0, s.graph_h * s.frac);
                            if (h < 0) {
                                h = Math.min(h, -5);
                            }
                            s.translate(0, -h);
                            if (h < s.graph_h * s.frac) {
                                s.ellipse(0, 0, 8, 8);
                            }

                            let tx = -150;
                            let ty = -110;
                            if (X < 150) {
                                tx = 20;
                            }
                            if (h + 110 > s.graph_h * s.frac) {
                                ty = h - s.graph_h * s.frac;
                            }
                            s.translate(tx, ty);

                            display_capacity_information(s, "Supply", supply, i)
                            break;
                        }
                    }
                }else{
                    for (let i = 0; i < demand["price"].length; i++) {
                        if (demand["cumul_capacities"][i] > c) {
                            s.fill(255);
                            h = map(demand["price"][i], 0, maxPrice, 0, s.graph_h * s.frac);
                            s.translate(0, -h);
                            if (h < s.graph_h * s.frac) {
                                s.ellipse(0, 0, 8, 8);
                            }

                            let tx = 20;
                            let ty = -110;
                            if (s.width < X + 150) {
                                tx = -150;
                            }
                            if (h + 110 > s.graph_h * s.frac) {
                                ty = h - s.graph_h * s.frac;
                            }
                            s.translate(tx, ty);

                            display_capacity_information(s, "Demand", demand, i)
                            break;
                        }
                    }
                }
                s.pop();
            }
            s.pop();

            fill_alt = 1;
            let oy = map(mp, 0, maxPrice, 0, s.graph_h * s.frac);
            let Y = s.graph_h * s.frac + 0.4 * margin - s.mouseY;
            s.noStroke();
            if (abs(X - ox) < 50 && abs(Y- oy) < 50) {
                s.push();
                let tx = ox + margin - 150;
                let ty = 0.4 * margin + s.graph_h - oy;
                if (ox < 150) {
                    tx = ox + margin + 20;
                }
                if (oy < 80){
                    ty = 0.4 * margin + s.graph_h - 80;
                }
                s.translate(tx, ty);
                for (let j = 0; j < 3; j++) {
                    s.translate(0, 16);
                    alternate_fill(s);
                    s.rect(0, 0, 130, 17);
                }
                s.translate(0, -2 * 16);
                s.fill(0);
                s.textFont(balooBold);
                s.text("Market optimum", 65, 4);
                s.textFont(font);
                s.textAlign(LEFT);
                s.translate(0, 16);
                s.text("Price", 5, 4);
                s.translate(0, 16);
                s.text("Quantity", 5, 4);
                s.textAlign(CENTER);
                s.translate(0, -16);
                s.push();
                s.textAlign(RIGHT, CENTER);
                s.text(display_money(mp), 97, 5);
                s.image(coin, 100, 2, 12, 12);
                s.pop();
                s.translate(0, 16);
                s.text(display_W(mq), 90, 4);
                s.pop();
            }
        }

        function display_capacity_information(s, title, data, i){
            for (let j = 0; j < 5; j++) {
                s.translate(0, 16);
                alternate_fill(s);
                s.rect(0, 0, 130, 17);
            }
            s.translate(0, -16 * 4);
            s.fill(0);
            s.textFont(balooBold);
            s.text(title, 65, 4);
            s.textFont(font);
            s.textAlign(LEFT);
            let left = ["Player", "Capacity", "Price", "facility"];
            for (let j of left) {
                s.translate(0, 16);
                s.text(j, 5, 4);
            }
            s.translate(0, -16 * 3);
            s.textAlign(CENTER);
            s.textFont(balooBold);
            let userObject = players[data["player_id"][i]];
            let username = userObject
                ? userObject.username
                : "Loading...";
            s.text(username, 90, 4);
            s.textFont(font);
            s.push();
            s.textAlign(RIGHT, CENTER);
            s.text(display_money(data["price"][i]), 97, 32 + 5);
            s.image(coin, 100, 32 + 2, 12, 12);
            s.pop();
            let right = [
                display_W(data["capacity"][i]),
                "",
                cols_and_names[data["facility"][i]][1],
            ];
            for (let j of right) {
                s.translate(0, 16);
                s.text(j, 90, 4);
            }
        }
    }

    s.mouseMoved = function() {
        if (s.mouseX>0 && s.mouseX<s.width && s.mouseY>0 && s.mouseY<s.height){
            s.redraw();
        }
    }

    s.mouseDragged = function() {
        s.mouseMoved();
    }

    s.render_graph = function(){
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin;
        s.graphics.background(229, 217, 182);

        if (s.view == "supply") {
            maxCap = max(...supply["cumul_capacities"], 100);
            maxPrice = max(...supply["price"], 1 / 1.1) * 1.1;
            minPrice = min(...supply["price"], 0) * 1.1;
        }else{
            maxCap = max(...demand["cumul_capacities"], 100);
            maxPrice = max(...demand["price"], 1 / 1.1) * 1.1;
            minPrice = min(...demand["price"], 0) * 1.1;
        }
        maxPrice = min(maxPrice, 5000);
        minCap = 0;
        s.frac = maxPrice / (maxPrice - minPrice);

        s.graphics.push();
        s.graphics.translate(margin, 0.4 * margin + s.graph_h);
        let view_order = [supply, demand];
        let v = int(s.view == "supply");
        if (s.market_mode == "normal") {
            generate_supply_and_demand_normal(s, view_order, v);
        }
        else if (s.market_mode == "log") {
            generate_supply_and_demand_log(s, view_order, v);
        }
        else if (s.market_mode == "zoom") {
            generate_supply_and_demand_zoom(s, view_order, v);
        }
        
        s.graphics.stroke(0);
        s.graphics.line(0, 0, s.graph_w, 0);
        s.graphics.line(0, (1 - s.frac) * s.graph_h, 0, -s.graph_h * s.frac);

        s.graphics.push();
        let interval = y_units_market(maxPrice - minPrice);
        s.graphics.fill(0);
        let y = map(interval, 0, maxPrice, 0, s.graph_h * s.frac);
        s.graphics.textAlign(RIGHT, CENTER);
        for (let i = 0; i <= s.graph_h * s.frac; i += y) {
            s.graphics.stroke(0, 0, 0, 30);
            s.graphics.line(s.graph_w, -i, 0, -i);
            s.graphics.stroke(0);
            s.graphics.line(0, -i, -5, -i);
            s.graphics.noStroke();
            s.graphics.image(coin, -23, -i - 6, 12, 12);
            s.graphics.text(display_money((interval * i) / y), -28, -i - 3);
        }
        s.graphics.pop();
        s.graphics.pop();

        s.graphics_ready = true;
        s.redraw();
    }
}

function change_res(i){
    show_selected_button("res_button_", i)
    res = resolution_list[i];
    temporal_graph_p5.render_graph();
}

function change_export_import(view){
    show_selected_button("export_import_button_", view)
    temporal_graph_p5.view = view;
    temporal_graph_p5.render_graph();
}

function change_price_mode(price_mode){
    show_selected_button("price_mode_button_", price_mode)
    temporal_graph_p5.price_mode = price_mode;
    temporal_graph_p5.render_graph();
}

function change_percent(percent){
    show_selected_button("percent_button_", percent)
    temporal_graph_p5.percent = percent;
    temporal_graph_p5.render_graph();
}

function change_market_view(view_market){
    show_selected_button("market_view_button_", view_market)
    market_chart_p5.view = view_market;
    market_chart_p5.render_graph();
}

function change_market_mode(market_mode){
    show_selected_button("market_mode_button_", market_mode)
    market_chart_p5.market_mode = market_mode;
    market_chart_p5.render_graph();
}

function change_categorisation_market(categorisation){
    show_selected_button("categorisation_market_button_", categorisation)
    market_chart_p5.categorisation = categorisation;
    market_chart_p5.render_graph();
}

function show_selected_button(button_id, id){
    let buttons = document.getElementsByClassName("selected");
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].id.includes(button_id)) {
            buttons[i].classList.remove("selected");
        }
    }
    document.getElementById(button_id + id).classList.add("selected");
}

function fetch_data() {
    load_chart_data((network = true)).then((raw_chart_data) => {
        fetch(`/api/get_market_data?t=${t_click}`) // retrieves data from server
            .then((response) => response.json())
            .then((raw_data) => {
                if (raw_data != null) {
                    supply = raw_data["capacities"];
                    demand = raw_data["demands"];
                    mq = raw_data["market_quantity"];
                    mp = raw_data["market_price"];
                } else {
                    supply = null;
                }
                
                Object.keys(raw_chart_data).forEach((key) => {
                    Object.keys(raw_chart_data[key]).forEach((subkey) => {
                        temporal_data[key][subkey] = {};
                        temporal_data[key][subkey][resolution_list[0]] = raw_chart_data[key][subkey][0].slice(-60);
                        for (r=0; r<resolution_list.length-1; r++){
                            temporal_data[key][subkey][resolution_list[r+1]] = raw_chart_data[key][subkey][r];
                        }
                    });
                });
                
                temporal_graph_p5.render_graph();
                market_chart_p5.render_graph();
            });
        })
        .catch((error) => {
            console.error("Error:", error);
        });
    load_players().then((players_) => {
        players = players_;
    });
}

function generate_supply_and_demand_normal(s, view_order, v){
    s.graphics.translate(0, - s.graph_h * (1 - s.frac));
    s.graphics.noStroke();
    s.graphics.push();
    for (i = 0; i < view_order[1-v]["capacity"].length; i++) {
        let w = map(view_order[1-v]["capacity"][i], 0, maxCap, 0, s.graph_w);
        let h = map(view_order[1-v]["price"][i], 0, maxPrice, 0, -s.graph_h * s.frac);
        if (h < 0) {
            h = Math.min(h, -5);
        }
        if (h > 0) {
            h = Math.max(h, 5);
        }
        if (s.categorisation == "facility") {
            s.graphics.fill(cols_and_names[view_order[1-v]["facility"][i]][0]);
        } else {
            s.graphics.fill(random_colors[view_order[1-v]["player_id"][i] % random_colors.length]);
        }
        s.graphics.rect(0, 0, w - 1, h);
        s.graphics.translate(w, 0);
    }
    s.graphics.pop();

    s.graphics.push();
    s.graphics.stroke(255, 0, 0);
    s.graphics.strokeWeight(3);
    for (i = 0; i < view_order[v]["capacity"].length; i++) {
        let w = map(view_order[v]["capacity"][i], 0, maxCap, 0, s.graph_w);
        let h = calc_h(s, view_order[v]["price"][i]);
        let h2 = s.graph_h * (1-s.frac);
        if (v==0){
            h2 = -s.height;
        }
        if (i + 1 < view_order[v]["capacity"].length) {
            h2 = calc_h(s, view_order[v]["price"][i + 1]);
        }
        s.graphics.line(0, h, w, h);
        s.graphics.line(w, h, w, h2);
        s.graphics.translate(w, 0);
    }
    s.graphics.pop();

    ox = map(mq, 0, maxCap, 0, s.graph_w);
    let oy = map(mp, 0, maxPrice, 0, s.graph_h * s.frac);
    s.graphics.fill(255, 0, 0);
    s.graphics.ellipse(ox, -oy, 10, 10);

    s.graphics.push();
    s.graphics.fill(0);
    let interval = y_units_market(maxCap);
    let x = map(interval, 0, maxCap, 0, s.graph_w);
    for (let i = 0; i <= s.graph_w; i += x) {
        s.graphics.stroke(0, 0, 0, 30);
        s.graphics.line(i, -s.graph_h * s.frac, i, (1 - s.frac) * s.graph_h);
        s.graphics.stroke(0);
        s.graphics.line(i, 0, i, 5);
        s.graphics.noStroke();
        s.graphics.text(display_W((interval * i) / x), i, 0.26 * margin);
    }
    s.graphics.pop();
}

function generate_supply_and_demand_log(s, view_order, v) {
    s.graphics.translate(0, - s.graph_h * (1 - s.frac));
    sqrt_supply_capacities = view_order[1-v]["capacity"].map(Math.sqrt);
    sqrt_demand_capacities = view_order[v]["capacity"].map(Math.sqrt);
    for (let i = 0; i < view_order[1-v]["price"].length; i++) {
        if (view_order[1-v]["price"][i] > -5 || view_order[1-v]["cumul_capacities"][i] > mq){
            if(i > 0){
                minCap = view_order[1-v]["cumul_capacities"][i-1];
            }else{
                minCap = 0;
            }
            break;
        }else{
            sqrt_supply_capacities[i] = 0;
        }
    }
    for (let i = 0; i < view_order[v]["price"].length; i++) {
        if (view_order[v]["cumul_capacities"][i] >= minCap) {
            let dx = (view_order[v]["cumul_capacities"][i] - minCap)/view_order[v]["capacity"][i];
            sqrt_demand_capacities[i] = Math.sqrt(view_order[v]["capacity"][i] * dx);
            break;
        }else{
            sqrt_demand_capacities[i] = 0;
        }
    }
    maxCap_sqrt_supply = sum_arr(sqrt_supply_capacities);
    maxCap_sqrt_demand = sum_arr(sqrt_demand_capacities);

    let ox_supply;
    for(let i = 0; i < view_order[1-v]["capacity"].length; i++){
        if (view_order[1-v]["cumul_capacities"][i] >= mq) {
            let cumul_capacities_sqrt = sum_arr(sqrt_supply_capacities.slice(0, i + 1));
            let overshoot_x = map(cumul_capacities_sqrt, 0, maxCap_sqrt_supply, 0, s.graph_w);
            if (view_order[1-v]["cumul_capacities"][i] == mq) {
                ox_supply = overshoot_x;
            }else{
                let dx = (view_order[1-v]["cumul_capacities"][i] - mq)/view_order[1-v]["capacity"][i];
                ox_supply = overshoot_x - dx * sqrt_supply_capacities[i]/maxCap_sqrt_supply*s.graph_w;
            }
            break;
        }
    }
    let ox_demand;
    for(let i = 0; i < view_order[v]["capacity"].length; i++){
        if (view_order[v]["cumul_capacities"][i] >= mq) {
            let cumul_capacities_sqrt = sum_arr(sqrt_demand_capacities.slice(0, i + 1));
            if (view_order[v]["cumul_capacities"][i] == mq) {
                ox_demand = map(cumul_capacities_sqrt, 0, maxCap_sqrt_demand, 0, s.graph_w);
            }else{
                let overshoot_x = map(cumul_capacities_sqrt, 0, maxCap_sqrt_demand, 0, s.graph_w);
                let dx = (view_order[v]["cumul_capacities"][i] - mq)/view_order[v]["capacity"][i];
                ox_demand = overshoot_x - dx * sqrt_demand_capacities[i]/maxCap_sqrt_demand*s.graph_w;
            }
            break;
        }
    }

    ox = ox_supply;
    maxCap_sqrt_supply *= ox_supply/ox;
    maxCap_sqrt_demand *= ox_demand/ox;

    s.graphics.noStroke();
    s.graphics.push();
    for (i = 0; i < view_order[1-v]["capacity"].length; i++) {
        let w = map(sqrt_supply_capacities[i], 0, maxCap_sqrt_supply, 0, s.graph_w);
        let h = map(view_order[1-v]["price"][i], 0, maxPrice, 0, -s.graph_h * s.frac);
        if (h < 0) {
            h = min(h, -5);
        }
        if (h > 0) {
            h = max(h, 5);
        }
        if (s.categorisation == "facility") {
            s.graphics.fill(cols_and_names[view_order[1-v]["facility"][i]][0]);
        } else {
            s.graphics.fill(random_colors[view_order[1-v]["player_id"][i] % random_colors.length]);
        }
        s.graphics.rect(0, 0, w - 1, h);
        s.graphics.translate(w, 0);
    }
    s.graphics.pop();

    s.graphics.push();
    s.graphics.stroke(255, 0, 0);
    s.graphics.strokeWeight(3);
    for (i = 0; i < view_order[v]["capacity"].length; i++) {
        let w = map(sqrt_demand_capacities[i], 0, maxCap_sqrt_demand, 0, s.graph_w);
        let h = calc_h(s, view_order[v]["price"][i]);
        let h2 = s.graph_h * (1-s.frac);
        if (v==0){
            h2 = -s.height;
        }
        if (i + 1 < view_order[v]["capacity"].length) {
            h2 = calc_h(s, view_order[v]["price"][i + 1]);
        }
        s.graphics.line(0, h, w, h);
        s.graphics.line(w, h, w, h2);
        s.graphics.translate(w, 0);
    }
    s.graphics.pop();

    s.graphics.push();
    s.graphics.noStroke();
    s.graphics.fill(255, 0, 0);
    let oy = map(mp, 0, maxPrice, 0, s.graph_h * s.frac);
    s.graphics.ellipse(ox, -oy, 10, 10);
    s.graphics.pop();

    s.graphics.push();
    s.graphics.fill(0);
    s.graphics.noStroke();
    s.graphics.text(display_W(minCap), 0, 0.26 * margin);
    s.graphics.text(display_W(maxCap), s.graph_w, 0.26 * margin);
    s.graphics.stroke(0);
    s.graphics.line(s.graph_w, 0, s.graph_w, 5);
    s.graphics.pop();

    function sum_arr(arr) {
        return arr.reduce((a, b) => a + b, 0);
    
    }
}

function generate_supply_and_demand_zoom(s, view_order, v){
    let window = 100000 * mq**0.17;
    maxCap = mq + window;
    minCap = mq - window;
    maxPrice = Math.min(maxPrice, Math.max(5.5, 2*mp));
    s.frac = maxPrice / (maxPrice - minPrice);
    s.graphics.translate(0, - s.graph_h * (1 - s.frac));

    s.graphics.noStroke();
    s.graphics.push();
    for (i = 0; i < view_order[1-v]["capacity"].length; i++) {
        if (view_order[1-v]["cumul_capacities"][i] > minCap) {
            let w = map(view_order[1-v]["capacity"][i], 0, maxCap - minCap, 0, s.graph_w);
            if (view_order[1-v]["cumul_capacities"][i] - minCap < view_order[1-v]["capacity"][i]) {
                w = map(view_order[1-v]["cumul_capacities"][i] - minCap, 0, maxCap - minCap, 0, s.graph_w);
            }
            if (view_order[1-v]["cumul_capacities"][i] > maxCap) {
                w = map(view_order[1-v]["capacity"][i] - view_order[1-v]["cumul_capacities"][i] + maxCap, 0, maxCap - minCap, 0, s.graph_w);
                if (view_order[1-v]["cumul_capacities"][i] - minCap < view_order[1-v]["capacity"][i]) {
                    w = s.graph_w;
                }
            }
            let h = map(view_order[1-v]["price"][i], 0, maxPrice, 0, -s.graph_h * s.frac);
            if (h < 0) {
                h = Math.min(h, -5);
            }
            if (h > 0) {
                h = Math.max(h, 5);
            }
            if (s.categorisation == "facility") {
                s.graphics.fill(cols_and_names[view_order[1-v]["facility"][i]][0]);
            } else {
                s.graphics.fill(random_colors[view_order[1-v]["player_id"][i] % random_colors.length]);
            }
            s.graphics.rect(0, 0, w - 1, h);
            if (view_order[1-v]["cumul_capacities"][i] > maxCap) {
                break;
            }
            s.graphics.translate(w, 0);
        }
    }
    s.graphics.pop();

    s.graphics.push();
    s.graphics.stroke(255, 0, 0);
    s.graphics.strokeWeight(3);
    for (i = 0; i < view_order[v]["capacity"].length; i++) {
        if (view_order[v]["cumul_capacities"][i] > minCap) {
            let w = map(view_order[v]["capacity"][i], 0, maxCap - minCap, 0, s.graph_w);
            if (view_order[v]["cumul_capacities"][i] - minCap < view_order[v]["capacity"][i]) {
                w = map(view_order[v]["cumul_capacities"][i] - minCap, 0, maxCap - minCap, 0, s.graph_w);
            }
            if (view_order[v]["cumul_capacities"][i] > maxCap) {
                w = map(view_order[v]["capacity"][i] - view_order[v]["cumul_capacities"][i] + maxCap, 0, maxCap - minCap, 0, s.graph_w);
                if (view_order[v]["cumul_capacities"][i] - minCap < view_order[v]["capacity"][i]) {
                    w = s.graph_w;
                }
            }
            let h = calc_h(s, view_order[v]["price"][i]);
            let h2 = s.graph_h * (1-s.frac);
            if (v==0){
                h2 = -s.height;
            }
            if (i + 1 < view_order[v]["capacity"].length) {
                h2 = calc_h(s, view_order[v]["price"][i + 1]);
            }
            s.graphics.line(0, h, w, h);
            if (view_order[v]["cumul_capacities"][i] > maxCap) {
                break;
            }
            s.graphics.line(w, h, w, h2);
            s.graphics.translate(w, 0);
        }
    }
    s.graphics.pop();

    ox = map(mq, minCap, maxCap, 0, s.graph_w);
    let oy = map(mp, 0, maxPrice, 0, s.graph_h * s.frac);
    s.graphics.fill(255, 0, 0);
    s.graphics.ellipse(ox, -oy, 10, 10);

    s.graphics.push();
    s.graphics.fill(0);
    let interval = y_units_market(maxCap-minCap);
    let x = map(interval, 0, maxCap-minCap, 0, s.graph_w);
    let mod = 1 - (minCap % interval) / interval;
    for (let i = x * mod; i <= s.graph_w; i += x) {
        s.graphics.stroke(0, 0, 0, 30);
        s.graphics.line(i, -s.graph_h * s.frac, i, (1 - s.frac) * s.graph_h);
        s.graphics.stroke(0);
        s.graphics.line(i, 0, i, 5);
        s.graphics.noStroke();
        s.graphics.text(display_W_special(minCap + interval * i / x, interval), i, 0.26 * margin);
    }
    s.graphics.pop();
}

function display_W(energy) {
    const units = [" W", " kW", " MW", " GW", " TW"];
    return general_format(energy, units);
}

function display_W_special(energy, interval) {
    const units = [" W", " kW", " MW", " GW", " TW"];
    let unit_index = 0;
    while (energy >= 10000 && unit_index < units.length - 1) {
        energy /= 1000;
        interval /= 1000;
        unit_index += 1;
    }
    const decimalPlaces = (interval.toString().split(".")[1] || "").length;
    let [integerPart, decimalPart] = energy.toFixed(decimalPlaces).split('.');
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return `${integerPart}${decimalPart ? '.' + decimalPart : ''}${units[unit_index]}`;
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

function alternate_fill(s) {
    if (fill_alt == 1) {
        fill_alt = 0;
        s.fill(214, 199, 154);
    } else {
        fill_alt = 1;
        s.fill(229, 217, 182);
    }
}

function calc_h(s, price) {
    if (price == null) {
        return -2 * s.graph_h;
    } else {
        return map(price, 0, maxPrice, 0, -s.graph_h * s.frac);
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

function y_units_market(maxNumber) {
    let interval = Math.floor(maxNumber / 5);
    const orderOfMagnitude = Math.floor(Math.log10(interval));
    const firstDigit = Math.floor(interval / 10 ** orderOfMagnitude);
    interval = firstDigit * 10 ** orderOfMagnitude;
    return interval;
}
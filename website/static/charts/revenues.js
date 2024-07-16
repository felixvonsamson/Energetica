const keys_revenues = [
    "industry",
    "exports",
    // O&M costs
    "watermill",
    "small_water_dam",
    "large_water_dam",
    "nuclear_reactor",
    "nuclear_reactor_gen4",
    "steam_engine",
    "coal_burner",
    "oil_burner",
    "gas_burner",
    "combined_cycle",
    "windmill",
    "onshore_wind_turbine",
    "offshore_wind_turbine",
    "CSP_solar",
    "PV_solar",
    "small_pumped_hydro",
    "large_pumped_hydro",
    "lithium_ion_batteries",
    "solid_state_batteries",
    "compressed_air",
    "molten_salt",
    "hydrogen_storage",
    "coal_mine",
    "oil_field",
    "gas_drilling_site",
    "uranium_mine",

    "imports",
    "dumping",
];

function graph_sketch(s){
    s.setup = function() {
        s.percent = "normal";
        s.is_inside = false;
        s.createCanvas(min(canvas_width, 1200), 0.6 * canvas_width);
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
            if (s.is_inside) {
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
                    let h = (-price_curve[t_view] / s.upper_bounds.price) * s.graph_h * s.frac;
                    s.ellipse(0, h, 8, 8);
                    s.pop();
                }

                let count = 2 + (s.price_mode != "off");

                if (!s.simplified) {
                    s.push();
                    let sum = s.upper_bounds.quantity;
                    if(s.percent == "percent"){
                        const groups = Object.keys(temporal_data[s.current_view]);
                        sum = groups.reduce((acc, group) => {
                            return acc + (temporal_data[s.current_view][group][res][t_view] || 0);
                        }, 0);
                    }
                    for (const group in temporal_data[s.current_view]) {
                        if (temporal_data[s.current_view][group][res][t_view] > 0) {
                            let h = -temporal_data[s.current_view][group][res][t_view] * s.graph_h / sum;
                            s.ellipse(0, h, 8, 8);
                            s.translate(0, h);
                        }
                    }
                    s.pop();

                    for(const group in temporal_data[s.current_view]){
                        if(temporal_data[s.current_view][group][res][t_view] > 0){
                            count += 1;
                        }
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
                fill_alt = 0;
                alternate_fill(s);
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
                
                if (!s.simplified) {
                    const keys = Object.keys(temporal_data[s.current_view]).reverse();
                    for(const group of keys){
                        if(temporal_data[s.current_view][group][res][t_view] > 0){
                            alternate_fill(s);
                            s.rect(0, 0, 160, 17);
                            s.push();
                            if(s.categorisation == "type"){
                                s.fill(cols_and_names[group][0]);
                            }else{
                                s.fill(random_colors[group % random_colors.length]);
                            }
                            s.rect(0, 0, 16, 17);
                            s.pop();
                            s.fill(0);
                            s.textAlign(LEFT, CENTER);
                            if(s.categorisation == "type"){
                                s.text(cols_and_names[group][1], 20, 5);
                            }else{
                                let username = players[int(group)].username;
                                s.text(username, 20, 5);
                            }
                            s.textAlign(CENTER, CENTER);
                            s.text(display_W(temporal_data[s.current_view][group][res][t_view]), 132, 5);
                            s.translate(0, 16);
                        }
                    }
                    if (s.mouseY > 0.4 * margin && s.mouseY < s.height - 0.6 * margin) {
                        if ((data_len - t_view - 1) * res_to_factor[res] < 1440) {
                            s.fill(0);
                            s.text("(click to see market)", 80, 5);
                        }
                    }
                }
                s.pop();
            }
        }
    }

    s.mouseMoved = function() {
        if (s.mouseX>0 && s.mouseX<s.width && s.mouseY>0 && s.mouseY<s.height){
            s.is_inside = true;
            s.redraw();
        }else{
            if(s.is_inside){
                s.is_inside = false;
                s.redraw();
            }
        }
    }

    s.mouseDragged = function() {
        s.mouseMoved();
    }

    s.render_graph = function(){
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin;
        s.graphics.background(229, 217, 182);

        data_len = 360;
        if (res == 0){
            data_len = 60;
        }

        const sums = Object.values(data.revenues).concat(Object.values(data.op_costs)).reduce(
            (acc, arr) => {
                arr[res].forEach((value, i) => {
                    if (value > 0) {
                        acc.positive[i] = (acc.positive[i] || 0) + value;
                    } else if (value < 0) {
                        acc.negative[i] = (acc.negative[i] || 0) + value;
                    }
                });
                return acc;
            },
            { positive: [], negative: [] }
        );

        s.lower_bound = Math.min(...Object.values(sums.negative));
        s.upper_bound = Math.max(...Object.values(sums.positive));
        if (s.upper_bound == 0) {
            s.upper_bound = 100;
        }
        s.frac = s.upper_bound / (s.upper_bound - s.lower_bound); // fraction of positive range in the graph

        s.graphics.push();
        s.graphics.translate(margin, 0.4 * margin + s.graph_h);
        s.graphics.noStroke();

        s.graphics.push();
        for (let t = 0; t < data_len; t++) {
            s.graphics.push();
            let sum = s.upper_bound;
            if(s.percent == "percent"){
                const goups = Object.keys(data.revenues);
                sum = goups.reduce((acc, group) => {
                    if (data.revenues[group][res][t] > 0){
                        return acc + (data.revenues[group][res][t] || 0);
                    }else{
                        return acc;
                    }
                }, 0);
            }
            for (const group in data.revenues) {
                if (data.revenues[group][res][t] > 0) {
                    s.graphics.fill(cols_and_names[group][0]);
                    let h = data.revenues[group][res][t] * s.graph_h / sum;
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
                let h1 = (price_curve[t - 1] / s.upper_bounds["price"]) * s.graph_h * s.frac;
                let h2 = (price_curve[t] / s.upper_bounds["price"]) * s.graph_h * s.frac;
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
            let y_ticks = y_units_bounded(s.graph_h, s.lower_bounds["price"], s.upper_bounds["price"]);
            s.graphics.fill(cols_and_names["price"][0]);
            s.graphics.textAlign(RIGHT, CENTER);
            for (let i in y_ticks) {
                if(s.simplified){
                    s.graphics.stroke(0, 0, 0, 30);
                    s.graphics.line(s.graph_w, -i, 0, -i);
                }
                s.graphics.stroke(cols_and_names["price"][0]);
                s.graphics.line(0, -i, -5, -i);
                s.graphics.noStroke();
                s.graphics.image(coin, -23, -i - 6, 12, 12);
                s.graphics.text(display_money(y_ticks[i]), -28, -i - 3);
            }
            s.graphics.pop();
        }

        if(!s.simplified){
            s.graphics.push();
            if(s.percent == "percent"){
                s.upper_bounds["quantity"] = 100;
            }
            let y_ticks3 = y_units_bounded(s.graph_h, s.lower_bounds["quantity"], s.upper_bounds["quantity"], divisions=4);
            s.graphics.fill(0);
            for (let i in y_ticks3) {
                s.graphics.stroke(0, 0, 0, 30);
                s.graphics.line(s.graph_w, -i, 0, -i);
                s.graphics.stroke(0);
                s.graphics.line(s.graph_w, -i, s.graph_w + 5, -i);
                s.graphics.noStroke();
                if(s.percent == "percent"){
                    s.graphics.text(y_ticks3[i] + "%", s.graph_w + 0.5 * margin, -i + 3);
                }else{
                    s.graphics.text(display_W(y_ticks3[i]), s.graph_w + 0.5 * margin, -i - 3);
                }
            }
            s.graphics.pop();
        }

        s.graphics.pop();

        s.graphics_ready = true;
        s.redraw();
    } 
}

function draw() {
    if (graph) {
        push();
        fill_alt = 1;
        image(graph, 0, 0);
        translate(0, 10);
        push();
        stroke(255);
        strokeWeight(2);
        let X = min(graph_w, max(0, mouseX - 2 * margin));
        let t = floor(map(X, 0, graph_w, 0, data_len));
        X += 2 * margin;
        if (t == data_len) {
            t = data_len - 1;
        }
        line(X, 0, X, graph_h);
        noStroke();
        translate(X, graph_h * f);
        let lines = 1;
        let h_max = 0;
        let total_power = 0;
        push();
        for (const key of keys_revenues) {
            if (key in data){
                if (data[key][t]*3600/clock_time < -1) {
                    let h = (-data[key][t] / maxSum) * graph_h * f;
                    ellipse(0, h, 8, 8);
                    translate(0, h);
                    lines += 1;
                    h_max -= h;
                    total_power += data[key][t] * 3600/clock_time;
                }
            }
        }
        pop();
        push();
        for (const key of keys_revenues) {
            if (key in data){
                if (data[key][t]*3600/clock_time > 1) {
                    let h = (-data[key][t] / maxSum) * graph_h * f;
                    ellipse(0, h, 8, 8);
                    translate(0, h);
                    lines += 1;
                    h_max -= h;
                    total_power += data[key][t] * 3600/clock_time;
                }
            }
        }
        pop();
        let tx = -180;
        let ty = mouseY - graph_h * f - 10;
        if (ty < -graph_h * f) {
            ty = -graph_h * f;
        } else if (ty > graph_h * (1 - f) - lines * 16 - 16) {
            ty = graph_h * (1 - f) - lines * 16 - 16;
        }
        if (t / data_len < 180 / graph_w) {
            tx = 20;
        }
        translate(tx, ty);
        alternate_fill();
        fill_alt = 1 - (lines % 2);
        rect(0, 0, 160, 17);
        fill(0);
        textFont(balooBold);
        text(display_duration((data_len - t - 1) * res_to_factor[res]), 80, 5);
        textFont(font);
        translate(0, 16 * lines);
        alternate_fill();
        rect(0, 0, 160, 17);
        fill(0);
        textFont(balooBold);
        text("TOTAL :", 40, 6);
        display_coin(formatted_money(total_power), 160, 0);
        textFont(font);
        for (const key of keys_revenues) {
            if (key in data){
                if (data[key][t]*3600/clock_time < -1 | data[key][t]*3600/clock_time > 1) {
                    alternate_fill();
                    translate(0, -16);
                    rect(0, 0, 160, 17);
                    push();
                    fill(cols_and_names[key][0]);
                    rect(0, 0, 16, 17);
                    pop();
                    fill(0);
                    textAlign(LEFT, CENTER);
                    text(cols_and_names[key][1], 20, 5);
                    textAlign(CENTER, CENTER);
                    display_coin(display_money(data[key][t] * 3600/clock_time), 160, 0);
                    fill(229, 217, 182);
                }
            }
        }
        pop();
        pop();
    }
}

function regen(res) {
    load_chart_data()
        .then((raw_data) => {
            background(229, 217, 182);
            Object.keys(raw_data["revenues"]).forEach((key) => {
                data[key] = reduce(raw_data["revenues"][key], res);
            });
            Object.keys(raw_data["op_costs"]).forEach((key) => {
                data[key] = reduce(raw_data["op_costs"][key], res);
            });
            data_len = data["industry"].length;
            push();
            noStroke();
            const sums = Object.values(data).reduce(
                (acc, arr) => {
                    arr.forEach((value, i) => {
                        if (value > 0) {
                            acc.positive[i] = (acc.positive[i] || 0) + value;
                        } else if (value < 0) {
                            acc.negative[i] = (acc.negative[i] || 0) + value;
                        }
                    });
                    return acc;
                },
                { positive: [], negative: [] }
            );
            maxSum = Math.max(...Object.values(sums.positive));
            minSum = Math.min(...Object.values(sums.negative));
            if (maxSum == 0) {
                maxSum = 100;
            }
            f = maxSum / (maxSum - minSum);
            translate(2 * margin, height - 2 * margin - 10 - graph_h * (1 - f));
            push();
            for (let t = 0; t < data_len; t++) {
                push();
                for (const key of keys_revenues) {
                    if (key in data){
                        if (data[key][t]*3600/clock_time > 1) {
                            fill(cols_and_names[key][0]);
                            let h = (data[key][t] / maxSum) * graph_h * f;
                            rect(0, 0, graph_w / data_len + 1, -h);
                            translate(0, -h);
                        }
                    }
                }
                pop();
                push();
                for (const key of keys_revenues) {
                    if (key in data){
                        if (data[key][t]*3600/clock_time < -1) {
                            fill(cols_and_names[key][0]);
                            let h = (data[key][t] / maxSum) * graph_h * f;
                            rect(0, 0, graph_w / data_len + 1, -h);
                            translate(0, -h);
                        }
                    }
                }
                pop();
                translate(graph_w / data_len, 0);
            }
            pop();
            stroke(0);
            line(0, 0, graph_w, 0);
            line(0, graph_h * (1 - f), 0, -graph_h * f);

            push();
            let units = time_unit(res, clock_time);
            fill(0);
            for (let i = 1; i < units.length; i++) {
                stroke(0, 0, 0, 30);
                let x = (i * graph_w) / (units.length - 1);
                line(x, -graph_h, x, 0);
                stroke(0);
                line(x, 0, x, 5);
                noStroke();
                text(units[i], x, 0.3 * margin);
            }
            pop();

            push();
            let y_ticks = y_units(maxSum * 3600/clock_time);
            let interval = y_ticks[1];
            fill(0);
            let y = map(interval, 0, maxSum * 3600/clock_time, 0, graph_h * f);
            for (let i = 0; i <= graph_h * f; i += y) {
                stroke(0, 0, 0, 30);
                line(graph_w, -i, 0, -i);
                stroke(0);
                line(0, -i, -5, -i);
                noStroke();
                display_coin(display_money((interval * i) / y), -8, -i - 10);
            }
            for (let i = -y; i >= -graph_h * (1 - f); i -= y) {
                stroke(0, 0, 0, 30);
                line(graph_w, -i, 0, -i);
                stroke(0);
                line(0, -i, -5, -i);
                noStroke();
                display_coin(display_money((interval * i) / y), -8, -i - 10);
            }
            pop();
            pop();

            for (let i = 0; i < buttons.length; i++) {
                push();
                translate(
                    1.5 * margin + (i * graph_w) / buttons.length,
                    height - margin - 10
                );
                buttons[i].display_button();
                pop();
            }

            graph = get();
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

function display_coin(money, x, y) {
    push();
    textAlign(RIGHT, CENTER);
    text(money, x - 29, y + 6);
    image(coin, x - 26, y + 2, 12, 12);
    text("/h", x - 3, y + 6);
    pop();
}

function calc_size() {
    graph_h = height - 2 * margin - 20;
    graph_w = width - 3 * margin;
}

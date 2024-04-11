const keys_emissions = [
    "carbon_capture",
    "steam_engine",
    "coal_burner",
    "oil_burner",
    "gas_burner",
    "combined_cycle",
    "nuclear_reactor",
    "nuclear_reactor_gen4",
    "construction",
    "coal_mine",
    "oil_field",
    "gas_drilling_site",
    "uranium_mine",
];

function draw() {
    if (graph) {
        push();
        fill_alt = 1;
        image(graph, 0, 0);
        translate(0, 10);
        push();
        stroke(255);
        strokeWeight(2);
        let X = min(graph_w, max(0, mouseX - 1.5 * margin));
        let t = floor(map(X, 0, graph_w, 0, data_len));
        X += 1.5 * margin;
        if (t == data_len) {
            t = data_len - 1;
        }
        line(X, 0, X, graph_h);
        noStroke();
        translate(X, graph_h*f);
        let lines = 1;
        let h_max = 0;
        let total_power = 0;
        push();
        for (const key of keys_emissions) {
            if (key in data){
                if (data[key][t] < -0.01) {
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
        for (const key of keys_emissions) {
            if (key in data){
                if (data[key][t] > 0.01) {
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
        text(display_kgh_long(total_power), 120, 6);
        textFont(font);
        for (const key of keys_emissions) {
            if (key in data){
                if (data[key][t] > 0.01 | data[key][t] < -0.01) {
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
                    text(display_kgh(data[key][t] * 3600/clock_time), 135, 5);
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
            Object.keys(raw_data["emissions"]).forEach((key) => {
                data[key] = reduce(raw_data["emissions"][key], res);
            });
            data_len = data["steam_engine"].length;
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
                { positive: [], negative: [0] }
            );
            maxSum = Math.max(...Object.values(sums.positive));
            minSum = Math.min(...Object.values(sums.negative));
            if (maxSum == 0) {
                maxSum = 100;
            }
            f = maxSum / (maxSum - minSum);
            translate(1.5 * margin, height - 2 * margin - 10 - graph_h * (1 - f));
            push();
            for (let t = 0; t < data_len; t++) {
                push();
                for (const key of keys_emissions) {
                    if (key in data){
                        if (data[key][t] > 0.01) {
                            fill(cols_and_names[key][0]);
                            let h = (data[key][t] / maxSum) * graph_h * f;
                            rect(0, 0, graph_w / data_len + 1, -h - 1);
                            translate(0, -h);
                        }
                    }
                }
                pop();
                push();
                for (const key of keys_emissions) {
                    if (key in data){
                        if (data[key][t] < -0.01) {
                            fill(cols_and_names[key][0]);
                            let h = (data[key][t] / maxSum) * graph_h * f;
                            rect(0, 0, graph_w / data_len + 1, -h-1);
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
            for (let i = 0; i < units.length; i++) {
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
                text(display_kgh((interval * i) / y), -0.75 * margin, -i - 4);
            }
            for (let i = -y; i >= -graph_h * (1 - f); i -= y) {
                stroke(0, 0, 0, 30);
                line(graph_w, -i, 0, -i);
                stroke(0);
                line(0, -i, -5, -i);
                noStroke();
                text(display_kgh((interval * i) / y), -0.75 * margin, -i - 4);
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

function calc_size() {
    graph_h = height - 2 * margin - 20;
    graph_w = width - 3 * margin;
}

const keys_resources = ["coal", "oil", "gas", "uranium"];
let rates = {};
let on_sale = {};
let capacities = {};

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
        let t = floor(map(X, 0, graph_w, 0, data_len - 1));
        X += 1.5 * margin;
        line(X, 0, X, graph_h);
        noStroke();
        translate(X, graph_h);
        for (const key of keys_resources) {
            if (key in data){
                let h = (-data[key][t] / capacities[key]) * graph_h;
                ellipse(0, h, 8, 8);
            }
        }
        let tx = -135;
        let ty = graph_h + 10 - mouseY;
        if (ty < 5 * 16) {
            ty = 5 * 16 + 2;
        } else if (ty > graph_h) {
            ty = graph_h;
        }
        if (t / data_len < 135 / graph_w) {
            tx = 20;
        }
        translate(tx, -ty);
        alternate_fill();
        fill_alt = 0;
        rect(0, 0, 115, 17);
        fill(0);
        textFont(balooBold);
        text(display_duration((data_len - t - 1) * res_to_factor[res]), 57, 5);
        textFont(font);
        for (const key of keys_resources) {
            if (key in data){
                if (data[key][t] > 0) {
                    alternate_fill();
                    translate(0, 16);
                    rect(0, 0, 115, 17);
                    push();
                    fill(cols_and_names[key][0]);
                    rect(0, 0, 16, 17);
                    pop();
                    fill(0);
                    textAlign(LEFT, CENTER);
                    text(cols_and_names[key][1], 20, 5);
                    textAlign(CENTER, CENTER);
                    text(display_kg(data[key][t]), 90, 5);
                    fill(229, 217, 182);
                }
            }
        }
        pop();
        if (
            (mouseX > width - 3.5 * margin) &
            (mouseX < width - 2.5 * margin) &
            (mouseY < 0.5 * height - 20) &
            (mouseY > 10)
        ) {
            show_stored(
                "coal",
                width - 3.5 * margin,
                mouseY,
                0.25 * height - 25
            );
        } else if (
            (mouseX > width - 2 * margin) &
            (mouseX < width - margin) &
            (mouseY < 0.5 * height - 20) &
            (mouseY > 10)
        ) {
            show_stored("oil", width - 2 * margin, mouseY, 0.25 * height - 25);
        } else if (
            (mouseX > width - 3.5 * margin) &
            (mouseX < width - 2.5 * margin) &
            (mouseY < height - 30) &
            (mouseY > 0.5 * height + 10)
        ) {
            show_stored(
                "gas",
                width - 3.5 * margin,
                mouseY,
                0.75 * height - 25
            );
        } else if (
            (mouseX > width - 2 * margin) &
            (mouseX < width - margin) &
            (mouseY < height - 30) &
            (mouseY > 0.5 * height + 10)
        ) {
            show_stored(
                "uranium",
                width - 2 * margin,
                mouseY,
                0.75 * height - 25
            );
        }
        pop();
    }
}

function show_stored(resource, x, y, y_fix) {
    push();
    noStroke();
    translate(x - 170, y);
    fill_alt = 1;
    alternate_fill();
    rect(0, 0, 160, 17);
    textFont(balooBold);
    fill(0);
    text(cols_and_names[resource][1], 80, 4);
    textFont(font);
    alternate_fill();
    translate(0, 16);
    rect(0, 0, 160, 17);
    textAlign(LEFT, CENTER);
    fill(0);
    text("Stored quantity", 5, 5);
    textAlign(CENTER, CENTER);
    text(display_kg(data[resource][data_len - 1]), 135, 5);
    translate(0, 16);
    alternate_fill();
    rect(0, 0, 160, 17);
    textAlign(LEFT, CENTER);
    fill(0);
    text("On sale", 5, 5);
    textAlign(CENTER, CENTER);
    text(display_kg(on_sale[resource]), 135, 5);
    translate(0, 16);
    alternate_fill();
    rect(0, 0, 160, 17);
    textAlign(LEFT, CENTER);
    fill(0);
    text("Storage capacity", 5, 5);
    textAlign(CENTER, CENTER);
    text(display_kg(capacities[resource]), 135, 5);
    translate(0, 16);
    alternate_fill();
    rect(0, 0, 160, 17);
    textAlign(LEFT, CENTER);
    fill(0);
    text("Domestic prod.", 5, 5);
    textAlign(CENTER, CENTER);
    text(display_kgh(rates[resource]), 135, 5);
    pop();
    push();
    translate(x, y_fix);
    fill(229, 217, 182);
    noStroke();
    rect(-5, 0, margin + 10, 20);
    textFont(balooBold);
    fill(0);
    text(
        round((data[resource][data_len - 1] / capacities[resource]) * 100) + "%",
        0.5 * margin,
        6
    );
    pop();
}

function regen(res) {
    retrieve_resource_data().then(() => {
        load_chart_data().then((raw_data) => {
            load_player_data().then((player_data) => {

                for (const key of keys_resources){
                    capacities[key] = player_data[1]["warehouse_capacities"][key]
                }

                background(229, 217, 182);
                Object.keys(raw_data["resources"]).forEach((key) => {
                    data[key] = reduce(raw_data["resources"][key], res);
                    data_len = data[key].length;
                });
                if (Object.keys(data).length == 0){
                    return
                }
                push();
                translate(1.5 * margin, height - 2 * margin - 10);
                noStroke();
                push();
                strokeWeight(3);
                for (const key of keys_resources) {
                    if (key in data){
                        stroke(cols_and_names[key][0]);
                        push();
                        for (let t = 1; t < data_len; t++) {
                            let h1 = (data[key][t - 1] / capacities[key]) * graph_h;
                            let h2 = (data[key][t] / capacities[key]) * graph_h;
                            line(0, -h1, graph_w / data_len, -h2);
                            translate(graph_w / (data_len - 1), 0);
                        }
                        pop();
                    }
                }
                pop();
                stroke(0);
                line(0, 0, graph_w, 0);
                line(0, 0, 0, -graph_h);

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
                let y_ticks = y_units(100);
                let interval = y_ticks[1];
                fill(0);
                let y = map(interval, 0, 100, 0, graph_h);
                for (let i = 0; i < y_ticks.length; i++) {
                    stroke(0, 0, 0, 30);
                    line(graph_w, -y * i, 0, -y * i);
                    stroke(0);
                    line(0, -y * i, -5, -y * i);
                    noStroke();
                    text(y_ticks[i] + "%", -0.75 * margin, -y * i - 4);
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

                push();
                translate(width - 0.4 * margin, 0.5 * height);
                rotate(radians(90));
                textSize(15);
                text("Resource storage capacity", 0, 0);
                pop();

                push();
                translate(width - 3.5 * margin, 0.5 * height - 50);
                fill(255);
                rect(0, 0, margin, -0.5 * height + 60);
                fill(cols_and_names["coal"][0]);
                let h =
                    (data["coal"][data_len - 1] / capacities["coal"]) *
                    (0.5 * height - 60);
                rect(0, 0, margin, -h);
                fill(60, 60, 60);
                h = (on_sale["coal"] / capacities["coal"]) * (0.5 * height - 60);
                rect(0, 0, margin, -h);
                textFont(balooBold);
                textSize(15);
                fill(0);
                text("Coal", 0.5 * margin, 10);
                textSize(12);
                text("+" + display_kgh(rates["coal"]), 0.5 * margin, 30);

                translate(1.5 * margin, 0);
                fill(255);
                rect(0, 0, margin, -0.5 * height + 60);
                fill(cols_and_names["oil"][0]);
                h = (data["oil"][data_len - 1] / capacities["oil"]) * (0.5 * height - 60);
                rect(0, 0, margin, -h);
                fill(171, 73, 103);
                h = (on_sale["oil"] / capacities["oil"]) * (0.5 * height - 60);
                rect(0, 0, margin, -h);
                textSize(15);
                fill(0);
                text("Oil", 0.5 * margin, 10);
                textSize(12);
                text("+" + display_kgh(rates["oil"]), 0.5 * margin, 30);

                translate(0, 0.5 * height);
                fill(255);
                rect(0, 0, margin, -0.5 * height + 60);
                fill(cols_and_names["uranium"][0]);
                h =
                    (data["uranium"][data_len - 1] / capacities["uranium"]) *
                    (0.5 * height - 60);
                rect(0, 0, margin, -h);
                fill(118, 224, 96);
                h = (on_sale["uranium"] / capacities["uranium"]) * (0.5 * height - 60);
                rect(0, 0, margin, -h);
                textSize(15);
                fill(0);
                text("Uranium", 0.5 * margin, 10);
                textSize(12);
                text("+" + display_kgh(rates["uranium"]), 0.5 * margin, 30);

                translate(-1.5 * margin, 0);
                fill(255);
                rect(0, 0, margin, -0.5 * height + 60);
                fill(cols_and_names["gas"][0]);
                h = (data["gas"][data_len - 1] / capacities["gas"]) * (0.5 * height - 60);
                rect(0, 0, margin, -h);
                fill(99, 121, 153);
                h = (on_sale["gas"] / capacities["gas"]) * (0.5 * height - 60);
                rect(0, 0, margin, -h);
                textSize(15);
                fill(0);
                text("Gas", 0.5 * margin, 10);
                textSize(12);
                text("+" + display_kgh(rates["gas"]), 0.5 * margin, 30);
                pop();
                graph = get();
            });
        });
    });
}

function calc_size() {
    graph_h = height - 2 * margin - 20;
    graph_w = width - 6 * margin;
}


function retrieve_resource_data() {
    return fetch("/get_resource_data")
        .then((response) => response.json())
        .then((raw_data) => {
            rates = raw_data[0];
            on_sale = raw_data[1];
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}
const keys_resources = ["coal", "gas", "uranium"];
let rates = {};
let on_sale = {};

function graph_sketch(s) {
    s.setup = function () {
        s.rates = {};
        s.on_sale = {};
        s.createCanvas(min(canvas_width, 1200), 0.55 * canvas_width);
        s.noLoop();
        s.textFont(font);
        s.textAlign(CENTER, CENTER);
        s.graphics = s.createGraphics(s.width, s.height);
        s.graphics.textAlign(CENTER, CENTER);
        s.graphics.textFont(font);
    }

    s.draw = function () {
        if (s.graphics_ready) {
            s.image(s.graphics, 0, 0);
            if (s.is_inside) {
                if (s.mouseX < s.width - 1.75 * margin) {
                    s.push();
                    s.stroke(255);
                    s.strokeWeight(2);
                    let X = min(s.graph_w, max(0, s.mouseX - margin));
                    t_view = floor(map(X, 0, s.graph_w, 0, data_len - 1));
                    t_view = min(359, t_view + s.t0);
                    s.translate(margin + X, s.graph_h + 0.2 * margin);
                    s.line(0, 0, 0, -s.graph_h);
                    s.noStroke();

                    let count = 4;

                    for (const key of keys_resources) {
                        if (key in data.resources) {
                            s.fill(cols_and_names[key][0]);
                            let h = (data.resources[key][res_id][t_view] / capacities[key]) * s.graph_h;
                            s.ellipse(0, -h, 8, 8);
                        }
                    }

                    let tx = -150;
                    let ty = - 0.2 * margin - s.graph_h + s.mouseY;
                    if (ty > - count * 16) {
                        ty = - count * 16;
                    }
                    if (X < 150) {
                        tx = 20;
                    }
                    s.translate(tx, ty);
                    fill_alt = 0;
                    alternate_fill(s);
                    s.rect(0, 0, 130, 17);
                    s.fill(0);
                    s.textFont(balooBold);
                    s.text(ticks_to_time((s.t0 + data_len - t_view - 1) * res_to_factor[res]), 65, 5);
                    s.textFont(font);
                    s.translate(0, 16);
                    for (const key of keys_resources) {
                        if (key in data.resources) {
                            alternate_fill(s);
                            s.rect(0, 0, 130, 17);
                            s.fill(cols_and_names[key][0]);
                            s.rect(0, 0, 16, 17);
                            s.fill(0);
                            s.textAlign(LEFT, CENTER);
                            s.text(cols_and_names[key][1], 20, 5);
                            s.textAlign(CENTER, CENTER);
                            s.text(format_mass(data.resources[key][res_id][t_view]), 100, 5);
                            s.translate(0, 16);
                        }
                    }
                    s.pop();
                } else if (s.mouseY < 0.2 * margin + s.bar_h + s.bar_spacing) {
                    show_stored(s, "coal", s.width - 1.5 * margin, s.mouseY, 0.5 * s.bar_h);
                } else if (s.mouseY < 0.2 * margin + 2 * (s.bar_h + s.bar_spacing)) {
                    show_stored(s, "gas", s.width - 1.5 * margin, s.mouseY, 1.5 * s.bar_h + s.bar_spacing);
                } else {
                    show_stored(s, "uranium", s.width - 1.5 * margin, s.mouseY, 2.5 * s.bar_h + 2 * s.bar_spacing);
                }
            }
        }
    }

    s.mouseMoved = function () {
        if (s.mouseX > 0 && s.mouseX < s.width && s.mouseY > 0 && s.mouseY < s.height) {
            s.is_inside = true;
            s.redraw();
        } else {
            if (s.is_inside) {
                s.is_inside = false;
                s.redraw();
            }
        }
    }

    s.mouseDragged = function () {
        s.mouseMoved();
    }

    s.render_graph = function (regen_table = true) {
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 3 * margin;
        s.graphics.background(229, 217, 182);

        data_len = 360;
        s.t0 = 0;
        if (res == resolution_list[0]) {
            data_len = 60;
            s.t0 = 300;
        }

        retrieve_resource_data().then(() => {
            load_player_data().then((player_data) => {
                capacities = {};
                for (const key of keys_resources) {
                    capacities[key] = player_data.config.warehouse_capacities[key]
                    s.rates[key] = (data.resources[key][0].at(-1) - data.resources[key][0].at(-2)) * 3600 / clock_time;
                }

                s.graphics.push();
                s.graphics.translate(margin, s.graph_h + 0.2 * margin);
                s.graphics.noStroke();
                s.graphics.push();
                s.graphics.strokeWeight(3);
                for (const key of keys_resources) {
                    if (key in data.resources) {
                        s.graphics.stroke(cols_and_names[key][0]);
                        s.graphics.push();
                        for (let t = 1 + s.t0; t < data_len + s.t0; t++) {
                            let h1 = (data.resources[key][res_id].at(t - 1) / capacities[key]) * s.graph_h;
                            let h2 = (data.resources[key][res_id].at(t) / capacities[key]) * s.graph_h;
                            s.graphics.line(0, -h1, s.graph_w / data_len, -h2);
                            s.graphics.translate(s.graph_w / (data_len - 1), 0);
                        }
                        s.graphics.pop();
                    }
                }
                s.graphics.pop();

                s.graphics.stroke(0);
                s.graphics.line(0, 0, s.graph_w, 0);
                s.graphics.line(0, 0, 0, -s.graph_h);

                s.graphics.push();
                let units = time_unit(res);
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

                s.graphics.push();
                let y_ticks = y_units_bounded(s.graph_h, 0, 100, divisions = 4);
                s.graphics.fill(0);
                for (let i in y_ticks) {
                    s.graphics.stroke(0, 0, 0, 30);
                    s.graphics.line(s.graph_w, -i, 0, -i);
                    s.graphics.stroke(0);
                    s.graphics.line(0, -i, -5, -i);
                    s.graphics.noStroke();
                    s.graphics.text(y_ticks[i] + "%", -0.5 * margin, -i + 3);
                }
                s.graphics.pop();
                s.graphics.pop();

                s.bar_spacing = 0.8 * margin;
                s.bar_h = (s.height - 0.2 * margin) / 3 - s.bar_spacing;
                s.graphics.push();
                s.graphics.translate(s.width - 0.4 * margin, 0.48 * s.height);
                s.graphics.rotate(radians(90));
                s.graphics.textSize(18);
                s.graphics.text("Resource storage capacity", 0, 0);
                s.graphics.pop();
                s.graphics.push();
                s.graphics.translate(s.width - 1.5 * margin, 0.2 * margin + s.bar_h);
                for (const resource of ["coal", "gas", "uranium"]) {
                    s.graphics.fill(255, 255, 255, 128);
                    s.graphics.rect(0, 0, 0.6 * margin, -s.bar_h);
                    s.graphics.fill(cols_and_names[resource][0]);
                    let h = (data.resources[resource][0].at(-1) / capacities[resource]) * s.bar_h;
                    s.graphics.rect(0, 0, 0.6 * margin, -h);
                    s.graphics.fill(255, 255, 255, 100);
                    h = (s.on_sale[resource] / capacities[resource]) * s.bar_h;
                    s.graphics.rect(0, 0, 0.6 * margin, -h);
                    s.graphics.textFont(balooBold);
                    s.graphics.textSize(15);
                    s.graphics.fill(0);
                    s.graphics.text(cols_and_names[resource][1], 0.3 * margin, 10);
                    s.graphics.textSize(12);
                    let sign = "";
                    if (s.rates[resource] > 0) {
                        sign = "+";
                    }
                    s.graphics.text(sign + format_mass_rate(s.rates[resource]), 0.3 * margin, 30);
                    s.graphics.translate(0, s.bar_h + s.bar_spacing);
                }
                s.graphics.pop();

                s.graphics_ready = true;
                s.redraw();
            });
        });
    }
}

function show_stored(s, resource, x, y, y_fix) {
    s.push();
    s.noStroke();
    s.translate(x - 170, y);
    fill_alt = 1;
    alternate_fill(s);
    s.rect(0, 0, 160, 17);
    s.textFont(balooBold);
    s.fill(0);
    s.text(cols_and_names[resource][1], 80, 4);
    s.textFont(font);
    alternate_fill(s);
    s.translate(0, 16);
    s.rect(0, 0, 160, 17);
    s.textAlign(LEFT, CENTER);
    s.fill(0);
    s.text("Stored quantity", 5, 5);
    s.textAlign(CENTER, CENTER);
    s.text(format_mass(data.resources[resource][0][359]), 135, 5);
    s.translate(0, 16);
    alternate_fill(s);
    s.rect(0, 0, 160, 17);
    s.textAlign(LEFT, CENTER);
    s.fill(0);
    s.text("On sale", 5, 5);
    s.textAlign(CENTER, CENTER);
    s.text(format_mass(s.on_sale[resource]), 135, 5);
    s.translate(0, 16);
    alternate_fill(s);
    s.rect(0, 0, 160, 17);
    s.textAlign(LEFT, CENTER);
    s.fill(0);
    s.text("Storage capacity", 5, 5);
    s.textAlign(CENTER, CENTER);
    s.text(format_mass(capacities[resource]), 135, 5);
    s.translate(0, 16);
    alternate_fill(s);
    s.rect(0, 0, 160, 17);
    s.textAlign(LEFT, CENTER);
    s.fill(0);
    s.text("Domestic prod.", 5, 5);
    s.textAlign(CENTER, CENTER);
    s.text(format_mass_rate(s.rates[resource]), 135, 5);
    s.pop();
    s.push();
    s.translate(x, y_fix);
    s.fill(229, 217, 182);
    s.noStroke();
    s.rect(-5, 0, 0.6 * margin + 10, 20);
    s.textFont(balooBold);
    s.fill(0);
    s.text(
        round((data.resources[resource][0][359] / capacities[resource]) * 100) + "%",
        0.3 * margin,
        6
    );
    s.pop();
}

function retrieve_resource_data() {
    return fetch("/api/get_resource_data")
        .then((response) => response.json())
        .then((raw_data) => {
            graph_p5.on_sale = raw_data;
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}
// data of the temporal graph
let temporal_data = { "network_data": {}, "exports": {}, "imports": {}, "generation": {}, "consumption": {} };
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
let categorization = "facility"; // facility or player
let ox;

// data for the energy flux graph
let energy_flux, revenue_flux;
let revenue_curves;

// data for the network capacities graph
let network_capacities;

// data sorting options
let descending = {
    "offers_table": false,
    "bids_table": true,
}
let offer_col = "price_col"; // current sorting column for offers
let bid_col = "price_col"; // current sorting column for bids

//styling variables
let margin;
let canvas_width;
let fill_alt = 0;

let t_view; // hovered timestamp
let t_click = 0; // clicked timestamp

let players = {};

//resolution buttons
let res = 60; //current resolution
let resolution_list = [60, 360, 2_160, 12_960, 77_760, 466_560];
let res_to_factor = {
    60: 1,
    360: 1,
    2_160: 6,
    12_960: 36,
    77_760: 216,
    466_560: 1296,
};

let cols_and_names = {};
let random_colors = [];

function preload() {
    font = loadFont("static/fonts/Baloo2-VariableFont_wght.ttf");
    balooBold = loadFont("static/fonts/Baloo2-SemiBold.ttf");
    coin = loadImage("static/images/icons/coin.svg");
}

update_resolution_button_text(in_game_seconds_per_tick);

var temporal_graph_p5, market_chart_p5, temporal_imports_p5, network_capacities_p5, import_overview_p5;

function setup() {
    noCanvas();
    random_colors = [
        color(166, 206, 227),
        color(31, 120, 180),
        color(178, 223, 138),
        color(51, 160, 44),
        color(251, 154, 153),
        color(227, 26, 28),
        color(253, 191, 111),
        color(255, 127, 0),
        color(202, 178, 214),
        color(106, 61, 154),
        color(255, 255, 153),
        color(177, 89, 40),
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
        revenues: [color(0, 0, 139), "Revenues"],

        imports: [color(255, 89, 94), "Imports"],
        exports: [color(138, 201, 38), "Exports"],
    };

    canvas_width = 0.7 * windowWidth;
    if (windowWidth < 1200) {
        canvas_width = windowWidth;
    }
    margin = min(70, canvas_width / 10);

    import_overview_p5 = new p5(import_overview_sketch, "import_overview")

    temporal_imports_p5 = new p5(temporal_imports_sketch, "temporal_imports");

    network_capacities_p5 = new p5(network_capacities_sketch, "network_capacities");

    temporal_graph_p5 = new p5(temporal_graph_sketch, "temporal_graph");

    market_chart_p5 = new p5(market_chart_sketch, "market_chart");

    change_page_view(server_saved_view)
}

function change_page_view(view) {
    send_form("/api/change_graph_view", {
        view: view,
    }).catch((error) => {
        console.error(`caught error ${error}`);
    });
    show_selected_button("page_view_button_", view);
    if (view == "basic") {
        document.getElementById("import_overview_container").style.display = "block";
        document.getElementById("temporal_imports_container").style.display = "none";
        document.getElementById("network_capacities").style.display = "block";
        document.getElementById("temporal_graph_container").style.display = "block";
        document.getElementById("network_prices_header").style.display = "flex";
        document.getElementById("percent_buttons_container").style.display = "none";
        document.getElementById("categorization_buttons_container").style.display = "none";
        document.getElementById("export_import_buttons_container").style.display = "none";
        document.getElementById("price_mode_button_smoothed").classList.add("right");
        document.getElementById("price_mode_button_off").style.display = "none";
        document.getElementById("market_chart_container").style.display = "none";
        document.getElementById("market_offers_tables").style.display = "none";
        temporal_graph_p5.simplified = true;
        network_capacities_p5.simplified = "simple";
    } else if (view == "normal") {
        document.getElementById("import_overview_container").style.display = "none";
        document.getElementById("temporal_imports_container").style.display = "block";
        document.getElementById("network_capacities").style.display = "block";
        document.getElementById("temporal_graph_container").style.display = "block";
        document.getElementById("network_prices_header").style.display = "none";
        document.getElementById("percent_buttons_container").style.display = "block";
        document.getElementById("categorization_buttons_container").style.display = "block";
        document.getElementById("export_import_buttons_container").style.display = "block";
        document.getElementById("price_mode_button_smoothed").classList.remove("right");
        document.getElementById("price_mode_button_off").style.display = "block";
        document.getElementById("market_chart_container").style.display = "block";
        document.getElementById("market_offers_tables").style.display = "none";
        temporal_graph_p5.simplified = false;
        network_capacities_p5.simplified = "simple";
    } else {
        document.getElementById("import_overview_container").style.display = "none";
        document.getElementById("temporal_imports_container").style.display = "block";
        document.getElementById("network_capacities").style.display = "block";
        document.getElementById("temporal_graph_container").style.display = "block";
        document.getElementById("network_prices_header").style.display = "none";
        document.getElementById("percent_buttons_container").style.display = "block";
        document.getElementById("categorization_buttons_container").style.display = "block";
        document.getElementById("export_import_buttons_container").style.display = "block";
        document.getElementById("price_mode_button_smoothed").classList.remove("right");
        document.getElementById("price_mode_button_off").style.display = "block";
        document.getElementById("market_chart_container").style.display = "none";
        document.getElementById("market_offers_tables").style.display = "block";
        temporal_graph_p5.simplified = false;
        network_capacities_p5.simplified = "complex";
    }
    fetch_temporal_network_data();
}

function import_overview_sketch(s) {
    s.setup = function () {
        s.createCanvas(0.3 * canvas_width, 0.3 * canvas_width);
        s.noLoop();
        s.graphics = s.createGraphics(s.width, s.height);
        s.graphics.textAlign(CENTER, CENTER);
        s.graphics.textFont(font);
    }

    s.draw = function () {
        if (s.graphics_ready) {
            s.image(s.graphics, 0, 0);
        }
    }

    s.render_graph = function () {
        s.graph_h = s.height - margin;
        s.graphics.noStroke();
        s.graphics.background(229, 217, 182);
        s.graphics.push();
        let exports = energy_flux[resolution_list[0]][59];
        let max_exports = max(max(0, ...energy_flux[resolution_list[0]]), -min(0, ...energy_flux[resolution_list[0]]));
        let arrow_w = map(abs(exports), 0, max_exports, 0.2 * margin, 0.6 * margin);
        s.graphics.translate(0.5 * margin, 0.5 * s.graph_h - 0.2 * margin);
        s.graphics.textSize(20);
        if (exports >= 0) {
            s.graphics.fill(0, 139, 0);
            s.graphics.text(format_power(abs(exports)), 0.5 * s.graph_h, -0.6 * margin - 5);
            s.graphics.fill(cols_and_names.exports[0]);
            s.graphics.triangle(s.graph_h + 0.5 * arrow_w, 0, s.graph_h - 0.5 * arrow_w, arrow_w, s.graph_h - 0.5 * arrow_w, -arrow_w);
        } else {
            s.graphics.fill(139, 0, 0);
            s.graphics.text(format_power(abs(exports)), 0.5 * s.graph_h, -0.6 * margin - 5);
            s.graphics.fill(cols_and_names.imports[0]);
            s.graphics.triangle(-0.5 * arrow_w, 0, 0.5 * arrow_w, arrow_w, 0.5 * arrow_w, -arrow_w);
        }
        s.graphics.rect(0, -0.5 * arrow_w, s.graph_h, arrow_w);
        s.graphics.translate(0, 1.4 * margin);
        let revenues = revenue_flux[resolution_list[0]][59];
        let max_revenues = max(max(0, ...revenue_flux[resolution_list[0]]), -min(0, ...revenue_flux[resolution_list[0]]));
        arrow_w = map(abs(revenues), 0, max_revenues, 0.2 * margin, 0.6 * margin);
        if (revenues >= 0) {
            s.graphics.fill(0, 139, 0);
            s.graphics.textAlign(RIGHT, CENTER);
            s.graphics.text(format_money(abs(revenues), ""), 0.5 * s.graph_h, 0.6 * margin - 5);
            s.graphics.image(coin, 0.5 * s.graph_h + 5, 0.6 * margin - 9, 18, 18);
            s.graphics.text("/h", 0.5 * s.graph_h + 43, 0.6 * margin - 5);
            s.graphics.fill(cols_and_names.exports[0]);
            s.graphics.triangle(-0.5 * arrow_w, 0, 0.5 * arrow_w, arrow_w, 0.5 * arrow_w, -arrow_w);
        } else {
            s.graphics.fill(139, 0, 0);
            s.graphics.textAlign(RIGHT, CENTER);
            s.graphics.text(format_money(abs(revenues), ""), 0.5 * s.graph_h, 0.6 * margin - 5);
            s.graphics.image(coin, 0.5 * s.graph_h + 5, 0.6 * margin - 9, 18, 18);
            s.graphics.text("/h", 0.5 * s.graph_h + 43, 0.6 * margin - 5);
            s.graphics.fill(cols_and_names.imports[0]);
            s.graphics.triangle(s.graph_h + 0.5 * arrow_w, 0, s.graph_h - 0.5 * arrow_w, arrow_w, s.graph_h - 0.5 * arrow_w, -arrow_w);
        }
        s.graphics.rect(0, -0.5 * arrow_w, s.graph_h, arrow_w);
        s.graphics.pop();
        s.graphics_ready = true;
        s.redraw();
    }
}

function temporal_imports_sketch(s) {
    s.setup = function () {
        s.smoothed = "normal";
        s.is_inside = false;
        s.createCanvas(min(canvas_width, 1200), 0.3 * canvas_width);
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
                s.push();
                s.stroke(255);
                s.strokeWeight(2);
                let X = min(s.graph_w, max(0, s.mouseX - margin));
                t_view = floor(map(X, 0, s.graph_w, 0, data_len - 1));
                s.translate(margin + X, s.graph_h + 0.4 * margin);
                s.line(0, 0, 0, -s.graph_h);
                s.noStroke();

                let h = map(energy_flux[res][t_view], s.lower_bounds.energy, s.upper_bounds.energy, 0, -s.graph_h);
                s.ellipse(0, h, 8, 8);
                h = map(revenue_curve[t_view], s.lower_bounds.revenues, s.upper_bounds.revenues, 0, -s.graph_h);
                s.ellipse(0, h, 8, 8);

                let count = 3;
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
                s.text(ticks_to_time((data_len - t_view - 1) * res_to_factor[res]), 80, 5);
                s.textFont(font);
                s.translate(0, 16);

                alternate_fill(s);
                s.rect(0, 0, 160, 17);
                s.push();
                if (energy_flux[res][t_view] >= 0) {
                    s.fill(cols_and_names.exports[0]);
                } else {
                    s.fill(cols_and_names.imports[0]);
                }
                s.rect(0, 0, 16, 17);
                s.pop();
                s.fill(0);
                s.textAlign(LEFT, CENTER);
                if (energy_flux[res][t_view] >= 0) {
                    s.text("Export", 20, 5);
                } else {
                    s.text("Import", 20, 5);
                }
                s.textAlign(CENTER, CENTER);
                s.text(format_power(abs(energy_flux[res][t_view])), 132, 5);
                s.translate(0, 16);

                alternate_fill(s);
                s.rect(0, 0, 160, 17);
                s.push();
                s.fill(cols_and_names.revenues[0]);
                s.rect(0, 0, 16, 17);
                s.pop();
                s.fill(0);
                s.textAlign(LEFT, CENTER);
                s.text(cols_and_names.revenues[1], 20, 5);
                s.textAlign(RIGHT, CENTER);
                s.text(format_money(revenue_curve[t_view], ""), 132, 5);
                s.text("/h", 158, 5);
                s.image(coin, 134, 2, 12, 12);

                s.pop();
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

    s.render_graph = function () {
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin;
        s.graphics.background(229, 217, 182);

        data_len = energy_flux[res].length;
        s.lower_bounds = {
            energy: min(0, ...energy_flux[res]),
            revenues: min(0, ...revenue_flux[res]),
        };
        s.upper_bounds = {
            energy: max(0, ...energy_flux[res]),
            revenues: max(0, ...revenue_flux[res]),
        };
        let range_energy = s.upper_bounds.energy - s.lower_bounds.energy;
        let range_revenues = s.upper_bounds.revenues - s.lower_bounds.revenues;
        let f1 = s.upper_bounds.energy / range_energy;
        let f2 = s.upper_bounds.revenues / range_revenues;
        let max_frac = max(f1, f2);
        let min_frac = min(f2 - 1, f1 - 1);
        s.lower_bounds.energy = min_frac * range_energy;
        s.lower_bounds.revenues = min_frac * range_revenues;
        s.upper_bounds.energy = max_frac * range_energy;
        s.upper_bounds.revenues = max_frac * range_revenues;

        s.graphics.push();
        s.graphics.translate(margin, 0.4 * margin + s.graph_h);
        s.graphics.noStroke();

        revenue_curve = [...revenue_flux[res]]
        if (s.smoothed == "smoothed") {
            let window_size = 5;
            // Generate Normalized Gaussian kernel
            let gaussian_kernel = [];
            for (let i = -window_size; i <= window_size; i++) {
                gaussian_kernel.push(Math.exp(-(i ** 2) / 10));
            }

            revenue_curve = []
            for (let t = 0; t < data_len; t++) {
                let start = max(0, t - window_size);
                let end = min(data_len - 1, t + window_size);
                let sum = 0;
                let weight_sum = 0;
                for (let i = start; i <= end; i++) {
                    sum += revenue_flux[res][i] * gaussian_kernel[i - t + window_size];
                    weight_sum += gaussian_kernel[i - t + window_size];
                }
                revenue_curve[t] = sum / weight_sum;
            }
        }

        s.graphics.push();
        let h0 = map(0, s.lower_bounds.energy, s.upper_bounds.energy, 0, -s.graph_h);
        for (let t = 0; t < data_len; t++) {
            if (energy_flux[res][t] < 0) {
                s.graphics.fill(cols_and_names.imports[0]);
            } else {
                s.graphics.fill(cols_and_names.exports[0]);
            }
            let h = map(energy_flux[res][t], s.lower_bounds.energy, s.upper_bounds.energy, 0, s.graph_h);
            s.graphics.rect(0, -h, s.graph_w / data_len + 1, h0 + h);
            s.graphics.translate(s.graph_w / data_len, 0);
        }
        s.graphics.pop();

        s.graphics.push();
        s.graphics.strokeWeight(3);
        s.graphics.stroke(cols_and_names.revenues[0]);
        for (let t = 1; t < data_len; t++) {
            let h1 = map(revenue_curve[t - 1], s.lower_bounds.revenues, s.upper_bounds.revenues, 0, s.graph_h);
            let h2 = map(revenue_curve[t], s.lower_bounds.revenues, s.upper_bounds.revenues, 0, s.graph_h);
            s.graphics.line(0, -h1, s.graph_w / data_len, -h2);
            s.graphics.translate(s.graph_w / (data_len - 1), 0);
        }
        s.graphics.pop();

        s.graphics.stroke(0);
        s.graphics.line(0, h0, s.graph_w, h0);
        s.graphics.line(0, 0, 0, -s.graph_h);
        s.graphics.line(s.graph_w, 0, s.graph_w, -s.graph_h);

        s.graphics.push();
        let units = time_unit(res);
        s.graphics.fill(0);
        for (let i = 0; i < units.length; i++) {
            s.graphics.stroke(0, 0, 0, 30);
            let x = (i * s.graph_w) / (units.length - 1);
            s.graphics.line(x, -s.graph_h, x, 0);
            s.graphics.stroke(0);
            s.graphics.line(x, h0, x, h0 + 5);
            s.graphics.noStroke();
            s.graphics.text(units[i], x, 0.26 * margin);
        }
        s.graphics.pop();

        s.graphics.push();
        let y_ticks = y_units_bounded(s.graph_h, s.lower_bounds.revenues, s.upper_bounds.revenues)
        s.graphics.fill(cols_and_names.revenues[0]);
        s.graphics.textAlign(RIGHT, CENTER);
        for (let i in y_ticks) {
            s.graphics.stroke(cols_and_names.revenues[0]);
            s.graphics.line(0, -i, -5, -i);
            s.graphics.noStroke();
            s.graphics.image(coin, -23, -i - 6, 12, 12);
            s.graphics.text(format_money(y_ticks[i], ""), -28, -i - 3);
        }
        s.graphics.pop();

        s.graphics.push();
        y_ticks = y_units_bounded(s.graph_h, s.lower_bounds.energy, s.upper_bounds.energy)
        s.graphics.fill(0);
        for (let i in y_ticks) {
            s.graphics.stroke(0, 0, 0, 30);
            s.graphics.line(s.graph_w, -i, 0, -i);
            s.graphics.stroke(0);
            s.graphics.line(s.graph_w, -i, s.graph_w + 5, -i);
            s.graphics.noStroke();
            s.graphics.text(format_power(y_ticks[i]), s.graph_w + 0.5 * margin, -i - 3);
        }
        s.graphics.pop();

        s.graphics.pop();

        s.graphics_ready = true;
        s.redraw();
    }
}

function change_smoothed(smoothed_mode) {
    if (smoothed_mode != "off") {
        show_selected_button("smoothed_button_", smoothed_mode);
        temporal_imports_p5.smoothed = smoothed_mode;
        temporal_imports_p5.render_graph();
    }
    show_selected_button("price_mode_button_", smoothed_mode);
    temporal_graph_p5.price_mode = smoothed_mode;
    temporal_graph_p5.render_graph();
}

function network_capacities_sketch(s) {
    s.setup = function () {
        s.is_inside = false;
        s.simplified = "complex";
        s.data = {
            simple: {
                categories: ["Renewables", "Controlables", "Storages"],
                Renewables: ["watermill", "small_water_dam", "large_water_dam", "windmill", "onshore_wind_turbine", "offshore_wind_turbine", "CSP_solar", "PV_solar"],
                Controlables: ["nuclear_reactor", "nuclear_reactor_gen4", "steam_engine", "coal_burner", "oil_burner", "gas_burner", "combined_cycle"],
                Storages: ["small_pumped_hydro", "large_pumped_hydro", "lithium_ion_batteries", "solid_state_batteries", "compressed_air", "molten_salt", "hydrogen_storage"],
            },
            complex: {
                categories: ["Hydro", "Wind", "Solar", "Fossil", "Nuclear", "Storages"],
                Hydro: ["watermill", "small_water_dam", "large_water_dam"],
                Wind: ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"],
                Solar: ["CSP_solar", "PV_solar"],
                Fossil: ["steam_engine", "coal_burner", "oil_burner", "gas_burner", "combined_cycle"],
                Nuclear: ["nuclear_reactor", "nuclear_reactor_gen4"],
                Storages: ["small_pumped_hydro", "large_pumped_hydro", "lithium_ion_batteries", "solid_state_batteries", "compressed_air", "molten_salt", "hydrogen_storage"],
            }
        }
        s.createCanvas(min(canvas_width, 1200), 0.3 * canvas_width);
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
                if (s.mouseY > 0.5 * margin && s.mouseY < s.height - 0.5 * margin) {
                    let x0 = margin + s.second_margin - 0.5 * s.bar_sp;
                    if (s.mouseX > x0 && s.mouseX < s.width - s.height - s.spacing - s.second_margin + 0.5 * s.bar_sp) {
                        let i = Math.floor((s.mouseX - x0) / (s.bar_sp + s.bar_w));
                        s.translate(x0 + s.bar_w + 10 + i * (s.bar_sp + s.bar_w), margin);
                        display_capacity_information(s.data[s.simplified][s.data[s.simplified].categories[i]]);
                    }
                    if (s.mouseX > s.width - margin - s.second_margin - s.graph_h && s.mouseX < s.width - margin - s.second_margin) {
                        s.translate(s.width - margin - s.second_margin - 0.5 * s.graph_h - 80, margin);
                        s.push();
                        s.noStroke();
                        fill_alt = 0;

                        let keys = Object.keys(temporal_data.generation).reverse();
                        for (let facility of keys) {
                            let current_generation = temporal_data.generation[facility][resolution_list[0]][59];
                            if (current_generation > 0) {
                                alternate_fill(s);
                                s.rect(0, 0, 160, 17);
                                s.push();
                                s.fill(cols_and_names[facility][0]);
                                s.rect(0, 0, 16, 17);
                                s.pop();
                                s.fill(0);
                                s.textAlign(LEFT, CENTER);
                                s.text(cols_and_names[facility][1], 20, 5);
                                s.textAlign(CENTER, CENTER);
                                let percentage = round(100 * current_generation / temporal_data.network_data.quantity[resolution_list[0]][59]);
                                s.text(percentage + "%", 132, 5);
                                s.translate(0, 16);
                            }
                        }
                    }
                }
            }
        }

        function display_capacity_information(facility_list) {
            s.push();
            s.noStroke();
            fill_alt = 0;
            alternate_fill(s);
            s.rect(0, 0, 216, 17);
            s.fill(0);
            s.textFont(balooBold);
            s.text("facility", 60, 5);
            s.text("max cap.", 132, 5);
            s.text("now", 188, 5);
            s.textFont(font);
            s.translate(0, 16);

            let power_cumsum = 0;
            let capacity = 0;
            for (let facility of [...facility_list].reverse()) {
                if (network_capacities[facility]) {
                    let current_generation = 0;
                    if (temporal_data.generation[facility]) {
                        current_generation = temporal_data.generation[facility][resolution_list[0]][59];
                    }
                    power_cumsum += current_generation;
                    capacity += network_capacities[facility].power;
                    alternate_fill(s);
                    s.rect(0, 0, 216, 17);
                    s.push();
                    s.fill(cols_and_names[facility][0]);
                    s.rect(0, 0, 16, 17);
                    s.pop();
                    s.fill(0);
                    s.textAlign(LEFT, CENTER);
                    s.text(cols_and_names[facility][1], 20, 5);
                    s.textAlign(CENTER, CENTER);
                    s.text(format_power(network_capacities[facility].power), 132, 5);
                    s.text(format_power(current_generation), 188, 5);
                    s.translate(0, 16);
                }
            }

            alternate_fill(s);
            s.rect(0, 0, 216, 17);
            s.fill(0);
            s.textFont(balooBold);
            s.text("TOTAL", 60, 5);
            s.text(format_power(capacity, 50000), 132, 5);
            s.text(format_power(power_cumsum, 50000), 188, 5);
            s.pop();
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

    s.render_graph = function () {
        s.spacing = min(margin, s.width / 20);
        let gauges_w = s.width - margin - s.spacing - s.height;
        s.bar_sp = gauges_w / 28 * 2;
        s.bar_w = s.bar_sp * 3 / 2;
        s.second_margin = 0;
        if (s.simplified == "simple") {
            s.spacing = min(2 * margin, s.width / 12);
            gauges_w = s.width - margin - 3 * s.spacing - s.height;
            s.bar_sp = gauges_w / 5;
            s.bar_w = s.bar_sp;
            s.second_margin = s.spacing;
        }
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin;
        s.graphics.background(229, 217, 182);

        s.graphics.push();

        s.graphics.translate(margin + s.second_margin, 0.5 * margin + s.graph_h);
        for (let category of s.data[s.simplified].categories) {
            display_gauge(category, s.data[s.simplified][category]);
            s.graphics.translate(s.bar_w + s.bar_sp, 0);
        }

        s.graphics.pop();

        s.graphics.push();
        s.graphics.translate(s.graph_w - 0.5 * s.graph_h + margin - s.second_margin, 0.5 * s.height);
        let cumul_angle = -0.5 * PI;
        for (let facility in temporal_data.generation) {
            let current_generation = temporal_data.generation[facility][resolution_list[0]][59];
            let angle = map(current_generation, 0, temporal_data.network_data.quantity[resolution_list[0]][59], 0, TWO_PI);
            if (angle > 0.001) {
                s.graphics.fill(cols_and_names[facility][0]);
                s.graphics.arc(0, 0, s.graph_h, s.graph_h, cumul_angle, cumul_angle + angle);
            }
            cumul_angle += angle;
        }
        s.graphics.noFill();
        s.graphics.strokeWeight(2);
        s.graphics.ellipse(0, 0, s.graph_h, s.graph_h);
        s.graphics.pop();

        s.graphics_ready = true;
        s.redraw();

        function display_gauge(category, facilities) {
            let category_capacity = 0;
            for (let facility of facilities) {
                if (network_capacities[facility]) {
                    category_capacity += network_capacities[facility].power;
                }
            }
            s.graphics.push();
            s.graphics.noStroke();
            s.graphics.fill(242, 236, 219);
            s.graphics.rect(0, 0, s.bar_w, -s.graph_h);
            for (let facility of facilities) {
                if (temporal_data.generation[facility]) {
                    let current_generation = temporal_data.generation[facility][resolution_list[0]][59];
                    if (current_generation > 0) {
                        s.graphics.fill(cols_and_names[facility][0]);
                        let h = map(current_generation, 0, category_capacity, 0, -s.graph_h);
                        s.graphics.rect(0, 0, s.bar_w, h - 1);
                        s.graphics.translate(0, h);
                    }
                }
            }
            s.graphics.pop();
            s.graphics.noFill();
            s.graphics.strokeWeight(2);
            s.graphics.rect(0, 0, s.bar_w, -s.graph_h);
            s.graphics.fill(0);
            s.graphics.textSize(15);
            s.graphics.text(format_power(category_capacity), 0.5 * s.bar_w, -s.graph_h - 0.25 * margin);
            s.graphics.textSize(min(20, s.width / 40));
            s.graphics.text(category, 0.5 * s.bar_w, 0.25 * margin);
        }
    }
}

function temporal_graph_sketch(s) {
    s.setup = function () {
        s.view = "exports";
        s.price_mode = "normal";
        s.percent = "normal";
        s.categorization = "type";
        s.simplified = false;
        s.is_inside = false;
        s.createCanvas(min(canvas_width, 1200), 0.4 * canvas_width);
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
                    s.translate(0, - s.graph_h * (1 - s.frac));
                    let h = (-price_curve[t_view] / s.upper_bounds.price) * s.graph_h * s.frac;
                    s.ellipse(0, h, 8, 8);
                    s.pop();
                }

                let count = 2 + (s.price_mode != "off");

                if (!s.simplified) {
                    s.push();
                    let sum = s.upper_bounds.quantity;
                    if (s.percent == "percent") {
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

                    for (const group in temporal_data[s.current_view]) {
                        if (temporal_data[s.current_view][group][res][t_view] > 0) {
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
                s.text(ticks_to_time((data_len - t_view - 1) * res_to_factor[res]), 80, 5);
                s.textFont(font);
                s.translate(0, 16);

                if (s.price_mode != "off") {
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
                    s.text(format_money(price_curve[t_view], ""), 137, 5);
                    s.image(coin, 140, 2, 12, 12);
                    s.translate(0, 16);
                }

                if (!s.simplified) {
                    const keys = Object.keys(temporal_data[s.current_view]).reverse();
                    for (const group of keys) {
                        if (temporal_data[s.current_view][group][res][t_view] > 0) {
                            alternate_fill(s);
                            s.rect(0, 0, 160, 17);
                            s.push();
                            if (s.categorization == "type") {
                                s.fill(cols_and_names[group][0]);
                            } else {
                                s.fill(random_colors[group % random_colors.length]);
                            }
                            s.rect(0, 0, 16, 17);
                            s.pop();
                            s.fill(0);
                            s.textAlign(LEFT, CENTER);
                            if (s.categorization == "type") {
                                s.text(cols_and_names[group][1], 20, 5);
                            } else {
                                let username = players[int(group)].username;
                                s.text(username, 20, 5);
                            }
                            s.textAlign(CENTER, CENTER);
                            s.text(format_power(temporal_data[s.current_view][group][res][t_view]), 132, 5);
                            s.translate(0, 16);
                        }
                    }
                    if (s.mouseY > 0.4 * margin && s.mouseY < s.height - 0.6 * margin) {
                        if ((data_len - t_view - 1) * res_to_factor[res] < 1440) {
                            s.fill(0);
                            s.textAlign(CENTER, CENTER);
                            s.text("(click to see market)", 80, 5);
                        }
                    }
                }
                s.pop();
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

    s.mousePressed = function () {
        if (s.mouseX > 0 && s.mouseX < s.width && s.mouseY > 0.4 * margin && s.mouseY < s.height - 0.6 * margin) {
            if ((data_len - t_view - 1) * res_to_factor[res] < 1440) {
                t_click = (data_len - t_view - 1) * res_to_factor[res];
                document.getElementById("market_time").innerHTML = ticks_to_time(t_click);
                fetch_market_data();
            }
        }
    }


    s.render_graph = function () {
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin;
        s.graphics.background(229, 217, 182);
        s.current_view = "generation";
        if (s.categorization == "player") {
            s.current_view = s.view;
        } else if (s.view == "imports") {
            s.current_view = "consumption";
        }

        data_len = temporal_data["network_data"]["price"][res].length;
        s.lower_bounds = {
            price: Math.min(0, ...temporal_data["network_data"]["price"][res]),
            quantity: 0,
        };
        s.upper_bounds = {
            price: Math.max(...temporal_data["network_data"]["price"][res], -s.lower_bounds["price"]),
            quantity: Math.max(...temporal_data["network_data"]["quantity"][res]),
        };
        s.frac = s.upper_bounds["price"] / (s.upper_bounds["price"] - s.lower_bounds["price"]); // fraction of positive range in the graph

        s.graphics.push();
        s.graphics.translate(margin, 0.4 * margin + s.graph_h);
        s.graphics.noStroke();

        if (!s.simplified) {
            s.graphics.push();
            for (let t = 0; t < data_len; t++) {
                s.graphics.push();
                let sum = s.upper_bounds["quantity"];
                if (s.percent == "percent") {
                    const groups = Object.keys(temporal_data[s.current_view]);
                    sum = groups.reduce((acc, group) => {
                        return acc + (temporal_data[s.current_view][group][res][t] || 0);
                    }, 0);
                }
                for (const group in temporal_data[s.current_view]) {
                    if (temporal_data[s.current_view][group][res][t] > 0) {
                        if (s.categorization == "type") {
                            s.graphics.fill(cols_and_names[group][0]);
                        } else {
                            s.graphics.fill(random_colors[group % random_colors.length]);
                        }
                        let h = temporal_data[s.current_view][group][res][t] * s.graph_h / sum;
                        s.graphics.rect(0, 0, s.graph_w / data_len + 1, -h - 1);
                        s.graphics.translate(0, -h);
                    }
                }
                s.graphics.pop();
                s.graphics.translate(s.graph_w / data_len, 0);
            }
            s.graphics.pop();
        }

        if (s.price_mode != "off") {
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

        if (s.price_mode != "off") {
            s.graphics.push();
            let y_ticks = y_units_bounded(s.graph_h, s.lower_bounds["price"], s.upper_bounds["price"]);
            s.graphics.fill(cols_and_names["price"][0]);
            s.graphics.textAlign(RIGHT, CENTER);
            for (let i in y_ticks) {
                if (s.simplified) {
                    s.graphics.stroke(0, 0, 0, 30);
                    s.graphics.line(s.graph_w, -i, 0, -i);
                }
                s.graphics.stroke(cols_and_names["price"][0]);
                s.graphics.line(0, -i, -5, -i);
                s.graphics.noStroke();
                s.graphics.image(coin, -23, -i - 6, 12, 12);
                s.graphics.text(format_money(y_ticks[i], ""), -28, -i - 3);
            }
            s.graphics.pop();
        }

        if (!s.simplified) {
            s.graphics.push();
            if (s.percent == "percent") {
                s.upper_bounds["quantity"] = 100;
            }
            let y_ticks3 = y_units_bounded(s.graph_h, s.lower_bounds["quantity"], s.upper_bounds["quantity"], divisions = 4);
            s.graphics.fill(0);
            for (let i in y_ticks3) {
                s.graphics.stroke(0, 0, 0, 30);
                s.graphics.line(s.graph_w, -i, 0, -i);
                s.graphics.stroke(0);
                s.graphics.line(s.graph_w, -i, s.graph_w + 5, -i);
                s.graphics.noStroke();
                if (s.percent == "percent") {
                    s.graphics.text(y_ticks3[i] + "%", s.graph_w + 0.5 * margin, -i + 3);
                } else {
                    s.graphics.text(format_power(y_ticks3[i]), s.graph_w + 0.5 * margin, -i - 3);
                }
            }
            s.graphics.pop();
        }

        s.graphics.pop();

        s.graphics_ready = true;
        s.redraw();
    }
}

function change_res(i) {
    show_selected_button("res_button_", i);
    show_selected_button("res_button_2_", i);
    res = resolution_list[i];
    temporal_graph_p5.render_graph();
    temporal_imports_p5.render_graph();
}

function change_categorization(categorization) {
    show_selected_button("categorization_button_", categorization)
    temporal_graph_p5.categorization = categorization;
    temporal_graph_p5.render_graph();
}

function change_export_import(view) {
    show_selected_button("export_import_button_", view)
    temporal_graph_p5.view = view;
    temporal_graph_p5.render_graph();
}

function change_percent(percent) {
    show_selected_button("percent_button_", percent)
    temporal_graph_p5.percent = percent;
    temporal_graph_p5.render_graph();
}

function market_chart_sketch(s) {
    s.setup = function () {
        s.view = "supply";
        s.market_mode = "normal";
        s.categorization = "facility";
        s.is_inside = false;
        s.createCanvas(min(canvas_width, 1200), 0.5 * canvas_width);
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
                    } else {
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
                } else {
                    s.push();
                    fill_alt = 1;
                    if (s.view == "supply") {
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
                    } else {
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
                if (abs(X - ox) < 50 && abs(Y - oy) < 50) {
                    s.push();
                    let tx = ox + margin - 150;
                    let ty = 0.4 * margin + s.graph_h - oy;
                    if (ox < 150) {
                        tx = ox + margin + 20;
                    }
                    if (oy < 80) {
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
                    s.text(format_money(mp, ""), 97, 5);
                    s.image(coin, 100, 2, 12, 12);
                    s.pop();
                    s.translate(0, 16);
                    s.text(format_power(mq), 90, 4);
                    s.pop();
                }
            }
        }

        function display_capacity_information(s, title, data, i) {
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
            let username = players[data["player_id"][i]].username;
            s.text(username, 90, 4);
            s.textFont(font);
            s.push();
            s.textAlign(RIGHT, CENTER);
            s.text(format_money(data["price"][i], ""), 97, 32 + 5);
            s.image(coin, 100, 32 + 2, 12, 12);
            s.pop();
            let right = [
                format_power(data["capacity"][i]),
                "",
                cols_and_names[data["facility"][i]][1],
            ];
            for (let j of right) {
                s.translate(0, 16);
                s.text(j, 90, 4);
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

    s.render_graph = function () {
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin;
        s.graphics.background(229, 217, 182);

        if (s.view == "supply") {
            maxCap = max(...supply["cumul_capacities"], 100);
            maxPrice = max(...supply["price"], 1 / 1.1) * 1.1;
            minPrice = min(...supply["price"], 0) * 1.1;
        } else {
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
            s.graphics.text(format_money((interval * i) / y, ""), -28, -i - 3);
        }
        s.graphics.pop();
        s.graphics.pop();

        s.graphics_ready = true;
        s.redraw();
    }
}

function change_market_view(view_market) {
    show_selected_button("market_view_button_", view_market)
    market_chart_p5.view = view_market;
    market_chart_p5.render_graph();
}

function change_market_mode(market_mode) {
    show_selected_button("market_mode_button_", market_mode)
    market_chart_p5.market_mode = market_mode;
    market_chart_p5.render_graph();
}

function change_categorization_market(categorization) {
    show_selected_button("categorization_market_button_", categorization)
    market_chart_p5.categorization = categorization;
    market_chart_p5.render_graph();
}

function show_selected_button(button_id, id) {
    let buttons = document.getElementsByClassName("selected");
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].id.includes(button_id)) {
            buttons[i].classList.remove("selected");
        }
    }
    document.getElementById(button_id + id).classList.add("selected");
}

function fetch_temporal_network_data() {
    load_players().then((players_) => {
        players = players_;
        fetch_market_data();
        fetch_network_capacities();
        load_chart_data().then((raw_chart_data) => {
            let imports = raw_chart_data.generation.imports;
            let exports = raw_chart_data.demand.exports;
            energy_flux = {};
            energy_flux[resolution_list[0]] = exports[0].map((num, idx) => num - imports[0][idx]).slice(-60);
            for (let i = 0; i < resolution_list.length - 1; i++) {
                energy_flux[resolution_list[i + 1]] = exports[i].map((num, idx) => num - imports[i][idx]);
            }
            let imports_revenue = raw_chart_data.revenues.imports;
            let exports_revenue = raw_chart_data.revenues.exports;
            revenue_flux = {};
            revenue_flux[resolution_list[0]] = exports_revenue[0].map((num, idx) => 3600 / in_game_seconds_per_tick * (num + imports_revenue[0][idx])).slice(-60);
            for (let i = 0; i < resolution_list.length - 1; i++) {
                revenue_flux[resolution_list[i + 1]] = exports_revenue[i].map((num, idx) => 3600 / in_game_seconds_per_tick * (num + imports_revenue[i][idx]));
            }

            import_overview_p5.render_graph();
            temporal_imports_p5.render_graph();
        });
        load_chart_data((network = true)).then((raw_chart_data) => {
            Object.keys(raw_chart_data).forEach((key) => {
                Object.keys(raw_chart_data[key]).forEach((subkey) => {
                    temporal_data[key][subkey] = {};
                    temporal_data[key][subkey][resolution_list[0]] = raw_chart_data[key][subkey][0].slice(-60);
                    for (r = 0; r < resolution_list.length - 1; r++) {
                        temporal_data[key][subkey][resolution_list[r + 1]] = raw_chart_data[key][subkey][r];
                    }
                });
            });
            temporal_graph_p5.render_graph();
        })
            .catch((error) => {
                console.error("Error:", error);
            });
    });
}

function fetch_market_data() {
    fetch(`/api/get_market_data?t=${t_click}`)
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

            market_chart_p5.render_graph();
            sortTable("offers_table", offer_col, reorder = false);
            sortTable("bids_table", bid_col, reorder = false);
        });
}

function fetch_network_capacities() {
    fetch(`/api/get_network_capacities`)
        .then((response) => response.json())
        .then((raw_data) => {
            network_capacities = raw_data;
            network_capacities_p5.render_graph();
        });
}

function sortTable(table_name, columnName, reorder = true) {
    const table = document.getElementById(table_name);
    let column = table.querySelector(`.${columnName}`);

    if (reorder) {
        // Check if the column is already sorted, toggle sorting order accordingly
        descending[table_name] = !descending[table_name];
    }

    let triangle = ' <i class="fa fa-caret-up"></i>';
    if (descending[table_name]) {
        triangle = ' <i class="fa fa-caret-down"></i>';
    }

    let data = transform_data(demand);
    let last_col = "Satisfied"
    if (table_name == "offers_table") {
        data = transform_data(supply);
        last_col = "Sold";
        offer_col = columnName;
    } else {
        bid_col = columnName;
    }
    // Sort the data based on the selected column
    const sortedData = Object.entries(data).sort((a, b) => {
        const aValue = a[1][columnName];
        const bValue = b[1][columnName];

        if (typeof aValue === "string" && typeof bValue === "string") {
            return descending[table_name] ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
        } else {
            return descending[table_name] ? bValue - aValue : aValue - bValue;
        }
    });

    let color_map = {
        "Yes": "green",
        "Partially": "orange",
        "No": "red"
    }

    // Rebuild the HTML table
    let html = `<tr>
        <th class="username_col" onclick="sortTable('${table_name}', 'username_col')">Player</th>
        <th class="facility_col" onclick="sortTable('${table_name}', 'facility_col')">Facility</th>
        <th class="price_col" onclick="sortTable('${table_name}', 'price_col')">Price</th>
        <th class="quantity_col" onclick="sortTable('${table_name}', 'quantity_col')">Capacity</th>
        <th class="sold_col" onclick="sortTable('${table_name}', 'sold_col')">${last_col}</th>
    </tr>`;
    for (const [id, capacity] of sortedData) {
        html += `<tr>
            <td>${capacity['username_col']}</td>
            <td>${capacity['facility_col']}</td>
            <td>${capacity['price_col']}</td>
            <td>${format_power(capacity['quantity_col'])}</td>
            <td class="table_${color_map[capacity['sold_col']]}">${capacity['sold_col']}</td>
            </tr>`;
    }
    table.innerHTML = html;

    // Update the sorting indicator
    column = table.querySelector(`.${columnName}`);
    column.innerHTML += triangle;

    function transform_data(data) {
        let transformed_data = [];
        for (let i = 0; i < data.capacity.length; i++) {
            transformed_data.push({
                "username_col": players[data.player_id[i]].username,
                "facility_col": cols_and_names[data.facility[i]][1],
                "price_col": data.price[i],
                "quantity_col": data.capacity[i],
                "sold_col": is_sold(data, i)
            })
        }
        return transformed_data;

        function is_sold(data, i) {
            if (data.cumul_capacities[i] <= mq) {
                return "Yes";
            }
            if (i == 0) {
                return "Partially";
            }
            if (data.cumul_capacities[i - 1] <= mq) {
                return "Partially";
            }
            return "No";
        }
    }
}

function generate_supply_and_demand_normal(s, view_order, v) {
    s.graphics.translate(0, - s.graph_h * (1 - s.frac));
    s.graphics.noStroke();
    s.graphics.push();
    for (i = 0; i < view_order[1 - v]["capacity"].length; i++) {
        let w = map(view_order[1 - v]["capacity"][i], 0, maxCap, 0, s.graph_w);
        let h = map(view_order[1 - v]["price"][i], 0, maxPrice, 0, -s.graph_h * s.frac);
        if (h < 0) {
            h = Math.min(h, -5);
        }
        if (h > 0) {
            h = Math.max(h, 5);
        }
        if (s.categorization == "facility") {
            s.graphics.fill(cols_and_names[view_order[1 - v]["facility"][i]][0]);
        } else {
            s.graphics.fill(random_colors[view_order[1 - v]["player_id"][i] % random_colors.length]);
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
        let h2 = s.graph_h * (1 - s.frac);
        if (v == 0) {
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
        s.graphics.text(format_power((interval * i) / x), i, 0.26 * margin);
    }
    s.graphics.pop();
}

function generate_supply_and_demand_log(s, view_order, v) {
    s.graphics.translate(0, - s.graph_h * (1 - s.frac));
    sqrt_supply_capacities = view_order[1 - v]["capacity"].map(Math.sqrt);
    sqrt_demand_capacities = view_order[v]["capacity"].map(Math.sqrt);
    for (let i = 0; i < view_order[1 - v]["price"].length; i++) {
        if (view_order[1 - v]["price"][i] > -5 || view_order[1 - v]["cumul_capacities"][i] > mq) {
            if (i > 0) {
                minCap = view_order[1 - v]["cumul_capacities"][i - 1];
            } else {
                minCap = 0;
            }
            break;
        } else {
            sqrt_supply_capacities[i] = 0;
        }
    }
    for (let i = 0; i < view_order[v]["price"].length; i++) {
        if (view_order[v]["cumul_capacities"][i] >= minCap) {
            let dx = (view_order[v]["cumul_capacities"][i] - minCap) / view_order[v]["capacity"][i];
            sqrt_demand_capacities[i] = Math.sqrt(view_order[v]["capacity"][i] * dx);
            break;
        } else {
            sqrt_demand_capacities[i] = 0;
        }
    }
    maxCap_sqrt_supply = sum_arr(sqrt_supply_capacities);
    maxCap_sqrt_demand = sum_arr(sqrt_demand_capacities);

    let ox_supply;
    for (let i = 0; i < view_order[1 - v]["capacity"].length; i++) {
        if (view_order[1 - v]["cumul_capacities"][i] >= mq) {
            let cumul_capacities_sqrt = sum_arr(sqrt_supply_capacities.slice(0, i + 1));
            let overshoot_x = map(cumul_capacities_sqrt, 0, maxCap_sqrt_supply, 0, s.graph_w);
            if (view_order[1 - v]["cumul_capacities"][i] == mq) {
                ox_supply = overshoot_x;
            } else {
                let dx = (view_order[1 - v]["cumul_capacities"][i] - mq) / view_order[1 - v]["capacity"][i];
                ox_supply = overshoot_x - dx * sqrt_supply_capacities[i] / maxCap_sqrt_supply * s.graph_w;
            }
            break;
        }
    }
    let ox_demand;
    for (let i = 0; i < view_order[v]["capacity"].length; i++) {
        if (view_order[v]["cumul_capacities"][i] >= mq) {
            let cumul_capacities_sqrt = sum_arr(sqrt_demand_capacities.slice(0, i + 1));
            if (view_order[v]["cumul_capacities"][i] == mq) {
                ox_demand = map(cumul_capacities_sqrt, 0, maxCap_sqrt_demand, 0, s.graph_w);
            } else {
                let overshoot_x = map(cumul_capacities_sqrt, 0, maxCap_sqrt_demand, 0, s.graph_w);
                let dx = (view_order[v]["cumul_capacities"][i] - mq) / view_order[v]["capacity"][i];
                ox_demand = overshoot_x - dx * sqrt_demand_capacities[i] / maxCap_sqrt_demand * s.graph_w;
            }
            break;
        }
    }

    ox = ox_supply;
    maxCap_sqrt_supply *= ox_supply / ox;
    maxCap_sqrt_demand *= ox_demand / ox;

    s.graphics.noStroke();
    s.graphics.push();
    for (i = 0; i < view_order[1 - v]["capacity"].length; i++) {
        let w = map(sqrt_supply_capacities[i], 0, maxCap_sqrt_supply, 0, s.graph_w);
        let h = map(view_order[1 - v]["price"][i], 0, maxPrice, 0, -s.graph_h * s.frac);
        if (h < 0) {
            h = min(h, -5);
        }
        if (h > 0) {
            h = max(h, 5);
        }
        if (s.categorization == "facility") {
            s.graphics.fill(cols_and_names[view_order[1 - v]["facility"][i]][0]);
        } else {
            s.graphics.fill(random_colors[view_order[1 - v]["player_id"][i] % random_colors.length]);
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
        let h2 = s.graph_h * (1 - s.frac);
        if (v == 0) {
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
    s.graphics.text(format_power(minCap), 0, 0.26 * margin);
    s.graphics.text(format_power(maxCap), s.graph_w, 0.26 * margin);
    s.graphics.stroke(0);
    s.graphics.line(s.graph_w, 0, s.graph_w, 5);
    s.graphics.pop();

    function sum_arr(arr) {
        return arr.reduce((a, b) => a + b, 0);

    }
}

function generate_supply_and_demand_zoom(s, view_order, v) {
    let window = 100000 * mq ** 0.17;
    maxCap = mq + window;
    minCap = mq - window;
    maxPrice = Math.min(maxPrice, Math.max(5.5, 2 * mp));
    s.frac = maxPrice / (maxPrice - minPrice);
    s.graphics.translate(0, - s.graph_h * (1 - s.frac));

    s.graphics.noStroke();
    s.graphics.push();
    for (i = 0; i < view_order[1 - v]["capacity"].length; i++) {
        if (view_order[1 - v]["cumul_capacities"][i] > minCap) {
            let w = map(view_order[1 - v]["capacity"][i], 0, maxCap - minCap, 0, s.graph_w);
            if (view_order[1 - v]["cumul_capacities"][i] - minCap < view_order[1 - v]["capacity"][i]) {
                w = map(view_order[1 - v]["cumul_capacities"][i] - minCap, 0, maxCap - minCap, 0, s.graph_w);
            }
            if (view_order[1 - v]["cumul_capacities"][i] > maxCap) {
                w = map(view_order[1 - v]["capacity"][i] - view_order[1 - v]["cumul_capacities"][i] + maxCap, 0, maxCap - minCap, 0, s.graph_w);
                if (view_order[1 - v]["cumul_capacities"][i] - minCap < view_order[1 - v]["capacity"][i]) {
                    w = s.graph_w;
                }
            }
            let h = map(view_order[1 - v]["price"][i], 0, maxPrice, 0, -s.graph_h * s.frac);
            if (h < 0) {
                h = Math.min(h, -5);
            }
            if (h > 0) {
                h = Math.max(h, 5);
            }
            if (s.categorization == "facility") {
                s.graphics.fill(cols_and_names[view_order[1 - v]["facility"][i]][0]);
            } else {
                s.graphics.fill(random_colors[view_order[1 - v]["player_id"][i] % random_colors.length]);
            }
            s.graphics.rect(0, 0, w - 1, h);
            if (view_order[1 - v]["cumul_capacities"][i] > maxCap) {
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
            let h2 = s.graph_h * (1 - s.frac);
            if (v == 0) {
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
    let interval = y_units_market(maxCap - minCap);
    let x = map(interval, 0, maxCap - minCap, 0, s.graph_w);
    let mod = 1 - (minCap % interval) / interval;
    for (let i = x * mod; i <= s.graph_w; i += x) {
        s.graphics.stroke(0, 0, 0, 30);
        s.graphics.line(i, -s.graph_h * s.frac, i, (1 - s.frac) * s.graph_h);
        s.graphics.stroke(0);
        s.graphics.line(i, 0, i, 5);
        s.graphics.noStroke();
        s.graphics.text(format_power_special(minCap + interval * i / x, interval), i, 0.26 * margin);
    }
    s.graphics.pop();
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

function time_unit(res) {
    let time_units = [];
    for (let i = 6; i >= 0; i--) {
        let ticks = res / 6 * i;
        time_units.push(ticks_to_time(ticks, ""));
    }
    return time_units;
}

function ticks_to_time(ticks, prefix = "t - ") {
    let minutes = Math.floor(ticks * in_game_seconds_per_tick / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);
    let years = Math.floor(days / 72);

    if (res * in_game_seconds_per_tick >= 3600 * 360) {
        minutes = 0;
    }
    if (res * in_game_seconds_per_tick >= 3600 * 360 * 24) {
        hours = 0;
    }
    days = days % 72;
    hours = hours % 24;
    minutes = minutes % 60;

    let time_sting = prefix;
    if (years > 0) {
        time_sting += years + "y ";
    }
    if (days > 0) {
        time_sting += days + "d ";
    }
    if (hours > 0) {
        time_sting += hours + "h ";
    }
    if (minutes > 0) {
        time_sting += minutes + "m ";
    }
    if (time_sting == prefix) {
        time_sting = "now";
    }
    if (time_sting == "1y ") {
        time_sting += "(72d)";
    }
    if (time_sting == "1d ") {
        time_sting += "(24h)";
    }
    return time_sting.trim();
}

function y_units_bounded(height, minNumber, maxNumber, divisions = 3) {
    let interval = Math.floor((maxNumber - minNumber) / divisions);
    const orderOfMagnitude = Math.floor(Math.log10(interval));
    const firstDigit = Math.floor(interval / 10 ** orderOfMagnitude);
    interval = firstDigit * 10 ** orderOfMagnitude;
    let values = {};
    for (let i = 0; i <= maxNumber; i += interval) {
        let h = map(i, minNumber, maxNumber, 0, height);
        values[h] = i;
    }
    for (let i = -interval; i >= minNumber; i -= interval) {
        let h = map(i, minNumber, maxNumber, 0, height);
        values[h] = i;
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
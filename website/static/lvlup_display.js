let player_assets, player_config

retrieve_ud();

function retrieve_ud() {
    load_constructions().then((construction_list) => {
        load_player_data().then((player_data) => {
            player_assets = player_data[0];
            player_config = player_data[1];
            change_info(construction_list[0]);
        });
    });
}

function change_info(constructions) {
    let lvls_in_progress = {};
    let config = player_config["assets"];
    for (const key in constructions){
        if (constructions[key].family == document.title){
            const name = constructions[key].name;
            lvls_in_progress[name] = (lvls_in_progress[name] || 0) + 1;
        }
    }
    load_const_config().then((const_config) => {
        for (const name in lvls_in_progress){
            let tile = document.getElementById(const_config[name]["name"]);

            let lvl = tile.querySelector("#lvl");
            lvl.innerHTML = player_assets[name] + " -> " + (player_assets[name] + lvls_in_progress[name]);

            let price = tile.querySelector("#price");
            let new_price =
                config[name]["price"] *
                const_config[name]["price multiplier"] ** lvls_in_progress[name];
            price.innerHTML = `${new_price
                .toFixed(0)
                .replace(
                    /\B(?=(\d{3})+(?!\d))/g,
                    "'"
                )}<img src="/static/images/icons/coin.svg" class="coin" alt="coin">`;

            let upgrade = tile.querySelector("#upgrade");
            upgrade.innerHTML =
                "lvl " +
                (player_assets[name] + lvls_in_progress[name]) +
                " -> lvl " +
                (player_assets[name] + lvls_in_progress[name] + 1);

            if ("requirements" in config[name]) {
                let requirements = tile.querySelector("#requirements");
                let unfullfilled = [];
                for (let i in config[name]["requirements"]) {
                    req = config[name]["requirements"][i][0];
                    if (
                        player_assets[req] <
                        config[name]["requirements"][i][1] + player_assets[name] + lvls_in_progress[name]
                    ) {
                        unfullfilled.push(req);
                    }
                }
                if (unfullfilled.length > 0) {
                    let html =
                        '<div><strong>Upgrade with :</strong><br><ul style="padding:0; margin:0;">';
                    for (let i in config[name]["requirements"]) {
                        html += '<li class="margin-small ';
                        req = config[name]["requirements"][i][0];
                        if (unfullfilled.includes(req)) {
                            html += "requirement";
                        } else {
                            html += "req_fullfilled";
                        }
                        html +=
                            '"> - ' +
                            const_config[req]["name"] +
                            " lvl " +
                            (config[name]["requirements"][i][1] +
                            player_assets[name] + lvls_in_progress[name]) +
                            "</li>";
                    }
                    html += " </ul></div>";
                    requirements.innerHTML = html;
                }
            }

            if (name == "thermodynamics") {
                let fuel_use = tile.querySelector("#fuel_use");
                let pollution = tile.querySelector("#pollution");
                let Efficiency_MS = tile.querySelector("#Efficiency_MS");
                let reduction =
                    (const_config[name]["efficiency_factor"] /
                        (1 +
                            const_config[name]["efficiency_factor"] *
                            player_assets[name] + lvls_in_progress[name])) *
                    100;
                fuel_use.innerHTML = "-" + reduction.toFixed(1) + "%";
                pollution.innerHTML = "-" + reduction.toFixed(1) + "%";
                let old_E_MS =
                    1 -
                    (1 - config["molten_salt"]["efficiency"]) *
                        0.9 ** (lvls_in_progress[name]);
                let new_E_MS = 10 / old_E_MS - 10;
                Efficiency_MS.innerHTML = "+" + new_E_MS.toFixed(1) + "%";
            } else if (name == "chemistry") {
                let E_Li_ion = tile.querySelector("#E_Li_ion");
                let E_SS = tile.querySelector("#E_SS");
                let old_E_Li_ion =
                    1 -
                    (1 - config["lithium_ion_batteries"]["efficiency"]) *
                    const_config[name]["efficiency_factor"] **
                            (lvls_in_progress[name]);
                let new_E_Li_ion = 10 / old_E_Li_ion - 10;
                E_Li_ion.innerHTML = "+" + new_E_Li_ion.toFixed(2) + "%";
                let old_E_SS =
                    1 -
                    (1 - config["solid_state_batteries"]["efficiency"]) *
                    const_config[name]["efficiency_factor"] **
                            (lvls_in_progress[name]);
                let new_E_SS = 10 / old_E_SS - 10;
                E_SS.innerHTML = "+" + new_E_SS.toFixed(2) + "%";
            }
        }
    });
}

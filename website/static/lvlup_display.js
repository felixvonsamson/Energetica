let ud, config;

preload();

function preload(){
    fetch("/get_ud_and_config?filter=technologies") // retrieves list of facilites under construction and config
    .then((response) => response.json())
    .then((raw_data) => {
      ud = raw_data[0];
      config = raw_data[1];
      for(id in ud){
        change_info(id);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function change_info(name){
    let tile = document.getElementById(ud[name]["name"]);
    let lvl = tile.querySelector("#lvl");
    let price = tile.querySelector("#price");
    let upgrade = tile.querySelector("#upgrade");
    //let reqirements = tile.querySelector("#reqirements");
    lvl.innerHTML = ud[name]["lvl_at"] + " -> " + ud[name]["lvl_future"];
    let new_price = config[name]["price"] * config[name]["price multiplier"]**(ud[name]["lvl_future"]-ud[name]["lvl_at"]);
    price.innerHTML = `${new_price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}<img src="/static/images/icons/coin.svg" class="coin" alt="coin">`;
    upgrade.innerHTML = "lvl " + ud[name]["lvl_future"] + " -> lvl " + (ud[name]["lvl_future"]+1);
    if(name == "thermodynamics"){
        let fuel_use = tile.querySelector("#fuel_use");
        let pollution = tile.querySelector("#pollution");
        let Efficiency_MS = tile.querySelector("#Efficiency_MS");
        let reduction = config[name]["efficiency factor"]/(1+config[name]["efficiency factor"]*ud[name]["lvl_future"])*100;
        fuel_use.innerHTML = "-" + reduction.toFixed(1) + "%";
        pollution.innerHTML = "-" + reduction.toFixed(1) + "%";
        let old_E_MS = 1 - (1-config["molten_salt"]["efficiency"]) * 0.9**(ud[name]["lvl_future"]-ud[name]["lvl_at"]);
        let new_E_MS = 10/old_E_MS-10;
        Efficiency_MS.innerHTML = "+" + new_E_MS.toFixed(1) + "%";
    }else if(name == "chemistry"){
        let E_Li_ion = tile.querySelector("#E_Li_ion");
        let E_SS = tile.querySelector("#E_SS");
        let old_E_Li_ion = 1 - (1-config["lithium_ion_batteries"]["efficiency"]) * config[name]["efficiency factor"]**(ud[name]["lvl_future"]-ud[name]["lvl_at"]);
        let new_E_Li_ion = 10/old_E_Li_ion-10;
        E_Li_ion.innerHTML = "+" + new_E_Li_ion.toFixed(2) + "%";
        let old_E_SS = 1 - (1-config["solid_state_batteries"]["efficiency"]) * config[name]["efficiency factor"]**(ud[name]["lvl_future"]-ud[name]["lvl_at"]);
        let new_E_SS = 10/old_E_SS-10;
        E_SS.innerHTML = "+" + new_E_SS.toFixed(2) + "%";
    }
}

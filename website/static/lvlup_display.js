let ud, config, player_lvls, filter;

retrieve_ud();

function retrieve_ud(){
    console.log(window.location.pathname)
    filter = "technologies";
    if(window.location.pathname == "/functional_facilities"){
      filter = "functional_facilities";
    }
    fetch(`/get_ud_and_config?filter=${filter}`) // retrieves list of facilites under construction and config
    .then((response) => response.json())
    .then((raw_data) => {
      ud = raw_data[0];
      config = raw_data[1];
      player_lvls = raw_data[2];
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
    lvl.innerHTML = ud[name]["lvl_at"] + " -> " + ud[name]["lvl_future"];

    let price = tile.querySelector("#price");
    let new_price = config[name]["price"] * config[name]["price multiplier"]**(ud[name]["lvl_future"]-ud[name]["lvl_at"]);
    price.innerHTML = `${new_price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}<img src="/static/images/icons/coin.svg" class="coin" alt="coin">`;
    
    let upgrade = tile.querySelector("#upgrade");
    upgrade.innerHTML = "lvl " + ud[name]["lvl_future"] + " -> lvl " + (ud[name]["lvl_future"]+1);

    if ("requirements" in config[name]){
      let reqirements = tile.querySelector("#reqirements");
      let unfullfilled = [];
      for(let i in config[name]["requirements"]){
        req = config[name]["requirements"][i][0];
        if (player_lvls[req] < config[name]["requirements"][i][1] + ud[name]["lvl_future"]){
          unfullfilled.push(req);
        }
      }
      if(unfullfilled.length > 0){
        let html = '<div><strong>Upgrade with :</strong><br><ul style="padding:0; margin:0;">'
        for(let i in config[name]["requirements"]){
          html += '<li class="margin-small '
          req = config[name]["requirements"][i][0];
          if(unfullfilled.includes(req)){
            html += "requirement"
          }else{
            html += "req_fullfilled"
          }
          html += '"> - ' + config[req]["name"] + " lvl " + (config[name]["requirements"][i][1] + ud[name]["lvl_future"]) + "</li>"
        }
        html += " </ul></div>"
        reqirements.innerHTML = html;
      }
    }

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
    }
    else if(name == "chemistry"){
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

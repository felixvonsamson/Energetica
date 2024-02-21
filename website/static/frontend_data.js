/* 
This code contains the functions to acess frontend data and retreive it if it is not avalable. 
*/

function load_constructions() {
    if (typeof(Storage) !== "undefined") {
        const constructionsData = sessionStorage.getItem("constructions");
        if (constructionsData) {
            return Promise.resolve(JSON.parse(constructionsData));
        }
    } 
    return retrieve_constructions();
}

function retrieve_constructions() {
    console.log("Feching construction data from the server")
    return fetch("/get_constructions")
        .then((response) => response.json())
        .then((raw_data) => {
            // Save fetched data to sessionStorage
            sessionStorage.setItem("constructions", JSON.stringify(raw_data));
            return raw_data;
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

function load_chart_data(network = false) {
    if (typeof(Storage) !== "undefined") {
        const chart_data = sessionStorage.getItem("chart_data");
        if (chart_data) {
            const last_value = JSON.parse(sessionStorage.getItem("last_value"));
            var currentDate = new Date();
            var last_date = new Date(last_value["time"]);
            if (currentDate.getTime() - last_date.getTime() > 120000){
                retrieve_player_data();
                return retrieve_chart_data(network);
            }
            if (network){
                const network_data = sessionStorage.getItem("network_data");
                return Promise.resolve(JSON.parse(network_data));
            }else{
                return Promise.resolve(JSON.parse(chart_data));
            }
        }
    }
    return retrieve_chart_data(network);
}
 
function retrieve_chart_data(network) {
    console.log("Feching chart data from the server")
    return fetch("/get_chart_data")
        .then((response) => response.json())
        .then((raw_data) => {
            var currentDate = new Date();
            sessionStorage.setItem("last_value", JSON.stringify({"total_t" : raw_data["total_t"], "time": currentDate}));
            sessionStorage.setItem("last_value_network", JSON.stringify({"total_t" : raw_data["total_t"], "time": currentDate}));
            sessionStorage.setItem("chart_data", JSON.stringify(raw_data["data"]));
            sessionStorage.setItem("network_data", JSON.stringify(raw_data["network_data"]));
            if (network){
                return raw_data["data"];
            }else{
                return raw_data["network_data"];
            }
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function load_player_data() {
    if (typeof(Storage) !== "undefined") {
        const player_data = sessionStorage.getItem("player_data");
        if (player_data) {
            return Promise.resolve(JSON.parse(player_data));
        }
    }
    return retrieve_player_data();
}
 
function retrieve_player_data() {
    console.log("Feching player data from the server")
    return fetch("/get_player_data")
        .then((response) => response.json())
        .then((raw_data) => {
            sessionStorage.setItem("player_data", JSON.stringify(raw_data));
            return raw_data;
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function load_const_config() {
    if (typeof(Storage) !== "undefined") {
        const const_config = sessionStorage.getItem("const_config");
        if (const_config) {
            return Promise.resolve(JSON.parse(const_config));
        }
    }
    return fetch("/get_const_config")
        .then((response) => response.json())
        .then((raw_data) => {
            sessionStorage.setItem("const_config", JSON.stringify(raw_data));
            return raw_data;
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}
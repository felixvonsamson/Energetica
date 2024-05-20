/* 
This code contains the functions to acess frontend data and retrieve it if it is not avalable. 
*/

if (window.location.pathname != "/login" && window.location.pathname != "/sign-up"){
    check_new_connection();
}

function check_new_connection(){
    if (typeof(Storage) !== "undefined") {
        const last_value = sessionStorage.getItem("last_value");
        if (last_value){
            const last_date = new Date(JSON.parse(last_value).time);
            const currentDate = new Date();
            if (currentDate.getTime() - last_date.getTime() > clock_time * 2000){
                retrieve_all();
            }else{
                show_unread_badges();
            }
            return;
        }
    }
    retrieve_all();
    return;
}

function retrieve_all(){
    retrieve_chart_data();
    retrieve_constructions();
    retrieve_shipments();
    retrieve_players();
    retrieve_player_data();
    retrieve_chats();
    if (!sessionStorage.getItem("player_id")){
        fetch("/get_player_id")
            .then((response) => response.json())
            .then((player_id) => {
                sessionStorage.setItem("player_id", player_id);
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }
}

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

function load_shipments() {
    if (typeof(Storage) !== "undefined") {
        const shipmentData = sessionStorage.getItem("shipments");
        if (shipmentData) {
            return Promise.resolve(JSON.parse(shipmentData));
        }
    } 
    return retrieve_shipments();
}

function retrieve_shipments() {
    console.log("Feching shipments data from the server")
    return fetch("/get_shipments")
        .then((response) => response.json())
        .then((raw_data) => {
            // Save fetched data to sessionStorage
            sessionStorage.setItem("shipments", JSON.stringify(raw_data));
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
 
function retrieve_chart_data(network = false) {
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
                return raw_data["network_data"];
            }else{
                return raw_data["data"];
            }
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function load_players() {
    if (typeof(Storage) !== "undefined") {
        const players = sessionStorage.getItem("players");
        if (players) {
            return Promise.resolve(JSON.parse(players));
        }
    }
    return retrieve_players()
}

function retrieve_players() {
    return fetch("/get_players")
        .then((response) => response.json())
        .then((raw_data) => {
            sessionStorage.setItem("players", JSON.stringify(raw_data));
            return raw_data;
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

function load_chats() {
    if (typeof(Storage) !== "undefined") {
        const chats = sessionStorage.getItem("chats");
        if (chats) {
            return Promise.resolve(JSON.parse(chats));
        }
    }
    return retrieve_chats();
}

function retrieve_chats(){
    fetch("/get_chat_list")
    .then((response) => response.json())
    .then((data) => {
        const unread_chat_count = Object.values(data.chat_list).reduce((count, chat) => count + (chat.unread_messages > 0 ? 1 : 0), 0);
        data.unread_chats = unread_chat_count;
        sessionStorage.setItem("chats", JSON.stringify(data));
        if (typeof refresh_chats === 'function') {
            refresh_chats();
        }
        show_unread_badges();
        return data;
    })
    .catch((error) => {
        console.error("Error:", error);
    });
}

function show_unread_badges(){
    const chats = sessionStorage.getItem("chats");
    if (chats) {
        const unread_chat_count = JSON.parse(chats).unread_chats;
        if(unread_chat_count > 0){
            let community_nav = document.getElementById("community");
            let messages_nav = document.getElementById("messages");
            community_nav.innerHTML += `<span id="unread_badge_community" class="unread_badge messages padding-small pine">${unread_chat_count}</span>`
            messages_nav.innerHTML += `<span id="unread_badge_messages" class="unread_badge messages padding-small pine">${unread_chat_count}</span>`
        }else{
            document.querySelectorAll("#unread_badge_community").forEach(function(badge) {
                badge.parentNode.removeChild(badge);
            });
            document.querySelectorAll("#unread_badge_messages").forEach(function(badge) {
                badge.parentNode.removeChild(badge);
            });
        }
    }
}
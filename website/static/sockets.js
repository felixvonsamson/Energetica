/* 
This code contains the main functions that communicate with the server (client side)
*/
socket.on("infoMessage", addToast);

socket.on("errorMessage", addError);

function send_form(endpoint, body) {
    return fetch(endpoint, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

//debug info for connection error
socket.on("connect_error", (err) => {
    // the reason of the error, for example "xhr poll error"
    console.log(err.message);
  
    // some additional description, for example the status code of the initial HTTP response
    console.log(err.description);
  
    // some additional context, for example the XMLHttpRequest object
    console.log(err.context);
  });


// information sent to the server when a new facility is created
function start_construction(facility, family) {
    send_form("/request_start_project", {
        facility: facility,
        family: family,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    let money = raw_data["money"];
                    var obj = document.getElementById("money");
                    obj.innerHTML = formatted_money(money);
                    addToast("Construction started");
                    sessionStorage.setItem("constructions", 
                    JSON.stringify(raw_data["constructions"]));
                    refresh_progressBar();
                } else if (response == "noSuitableLocationAvailable") {
                    addError("No suitable locations");
                } else if (response == "notEnoughMoneyError") {
                    addError("Not enough money");
                } else if (response == "locked") {
                    addError("Facility is locked! Nice try 😉");
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

socket.on("get_players", function (players) {
    sessionStorage.setItem("players", JSON.stringify(players));
});

// receive new values from the server
socket.on("new_values", function (changes) {
    let money = document.getElementById("money");
    if (money != null) {
        money.innerHTML = changes["money"];
    }
    let total_t = changes["total_t"];
    console.log("received new values : " + total_t);
    let last_value = JSON.parse(sessionStorage.getItem("last_value"));
    if (!last_value){
        retrieve_chart_data();
    }else if (last_value["total_t"] + 1 != total_t){
        retrieve_chart_data();
    }else{
        const currentDate = new Date();
        sessionStorage.setItem("last_value", JSON.stringify({"total_t" : total_t, "time": currentDate}));
        let chart_data = JSON.parse(sessionStorage.getItem("chart_data"));
        for (var category in changes["chart_values"]) {
            var subcategories = changes["chart_values"][category];
            for (var subcategory in subcategories) {
                if (!chart_data[category].hasOwnProperty(subcategory)) {
                    chart_data[category][subcategory] = Array.from({ length: 4 }, () => Array(1440).fill(0));
                }
                var value = subcategories[subcategory];
                var array = chart_data[category][subcategory]
                reduce_resolution(value, array, total_t);
            }
        }
        sessionStorage.setItem("chart_data", JSON.stringify(chart_data));
        if (typeof update_graph === 'function') {
            update_graph();
        }
    }
});

// receive new network values from the server
socket.on("new_network_values", function (changes) {
    let total_t = changes["total_t"];
    let last_value = JSON.parse(sessionStorage.getItem("last_value_network"));
    if (!last_value){
        retrieve_chart_data();
    }else if (last_value["total_t"] + 1 != total_t){
        retrieve_chart_data();
    }else{
        const currentDate = new Date();
        sessionStorage.setItem("last_value_network", JSON.stringify({"total_t" : total_t, "time": currentDate}));
        let network_data = JSON.parse(sessionStorage.getItem("network_data"));
        for (var category in changes["network_values"]) {
            var value = changes["network_values"][category];
            let array = network_data[category];
            reduce_resolution(value, array, total_t);
        }
        sessionStorage.setItem("network_data", JSON.stringify(network_data));
    }
});

function reduce_resolution(value, array, total_t){
    array[0].shift()
    array[0].push(value);
    let mod5 = total_t % 5
    if (mod5 != 0){
        array[1][1439] = array[0].slice(-mod5).reduce((acc, val) => acc + val, 0) / mod5
    }else{
        array[1].shift()
        let new_val = (4*array[1][1438] + array[0][1439])/5
        array[1].push(new_val);
    }
    let mod30 = total_t % 30
    if (mod30 != 0){
        array[2][1439] = array[0].slice(-mod30).reduce((acc, val) => acc + val, 0) / mod30
    }else{
        array[2].shift()
        let new_val = (29*array[1][1438] + array[0][1439])/30
        array[2].push(new_val);
    }
    let mod180 = total_t % 180
    if (mod180 != 0){
        array[3][1439] = array[0].slice(-mod180).reduce((acc, val) => acc + val, 0) / mod180
    }else{
        array[3].shift()
        let new_val = (179*array[1][1438] + array[0][1439])/180
        array[3].push(new_val);
    }
}

// updates specific fields of the page without reloading
socket.on("new_notification", function (notification) {
    let notification_list = document.getElementById("notification_list-small");
    if (notification_list != null) {
        notification_list.innerHTML += `<div id="notification_${notification["id"]}" class="notification padding-small margin-small">
        <b>${notification["title"]}</b><br>
        ${notification["content"]}
      </div>`;
    }
    notification_list = document.getElementById("notification_list");
    if (notification_list != null) {
        notification_list.innerHTML += `<div id="notification_${notification["id"]}" class="notification padding medium margin-large">
        <div class="small notification_time"><script>formatDateTime("${notification["time"]}");</script></div>
         <div class="flex-row align-items-center notification_head">
           <b>${notification["title"]}<i class="fa fa-circle small padding"></i></b>
           <span onclick="delete_notification(this, ${notification["id"]});" class="cross">×</span></div>
           ${notification["content"]}
       </div>`;
    }
    let notification_button = document.getElementById("notification_button");
    if (notification_button != null) {
        let unread_badge = document.getElementById("unread_badge");
        if (unread_badge != null) {
            unread_badge.innerHTML = int(unread_badge.innerHTML) + 1;
        }else{
            notification_button.innerHTML += '<span id="unread_badge" class="unread_badge small pine padding-small">1</span>';
        }
    }
});

socket.on("pause_construction", function (info) {
    load_constructions().then((construction_list) => {
        console.log(construction_list);
        construction_list[0][info["construction_id"]]["suspension_time"] = info["suspension_time"]
        sessionStorage.setItem(
            "constructions",
            JSON.stringify(construction_list)
        );
        display_progressBars(construction_list);
    });
});

socket.on("display_new_message", function (msg) {
    let obj = document.getElementById("messages_field");
    if (obj != null) {
        obj.innerHTML += msg;
    }
});

// reloads the page
socket.on("refresh", function () {
    window.location = window.location;
});

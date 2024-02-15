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

// receive new values from the server
socket.on("new_values", function (changes) {
    let money = document.getElementById("money");
    if (money != null) {
        money.innerHTML = changes["money"];
    }
    let total_t = changes["total_t"];
    console.log("received new values : " + total_t);
    const last_value = JSON.parse(sessionStorage.getItem("last_value"));
    if (last_value["total_t"] + 1 != total_t){
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
                array[0].shift()
                array[0].push(value);
                let mod5 = total_t % 5
                array[1][array.length - 1] = array[0].slice(-mod5).reduce((acc, val) => acc + val, 0) / mod5
                if (mod5 == 0){
                    array[1].shift()
                    array[1].push(array[array[1].length - 1]);
                }
                let mod30 = total_t % 30
                array[2][array.length - 1] = array[0].slice(-mod30).reduce((acc, val) => acc + val, 0) / mod30
                if (mod30 == 0){
                    array[2].shift()
                    array[2].push(array[array[2].length - 1]);
                }
                let mod180 = total_t % 180
                array[3][array.length - 1] = array[0].slice(-mod180).reduce((acc, val) => acc + val, 0) / mod180
                if (mod180 == 0){
                    array[3].shift()
                    array[3].push(array[array[3].length - 1]);
                }
            }
        }
        sessionStorage.setItem("chart_data", JSON.stringify(chart_data));
        if (typeof update_graph === 'function') {
            update_graph();
        }
    }
});

// updates specific fields of the page without reloading
socket.on("update_data", function (changes) {
    for (let field_id in changes) {
        let obj = document.getElementById(field_id);
        if (obj != null) {
            obj.innerHTML = changes[field_id];
        }
    }
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

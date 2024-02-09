/* 
This code contains the functions to acess frontend data and retreive it if it is not avalable. 
*/

function load_constructions() {
    if (typeof(Storage) !== "undefined") {
        const constructionsData = localStorage.getItem("constructions");
        if (constructionsData) {
            return Promise.resolve(JSON.parse(constructionsData));
        }
    } 
    return retrieve_constructions();
}

function retrieve_constructions() {
    return fetch("/get_constructions")
        .then((response) => response.json())
        .then((raw_data) => {
            // Save fetched data to localStorage
            localStorage.setItem("constructions", JSON.stringify(raw_data));
            return raw_data;
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

function load_chart_data() {
    if (typeof(Storage) !== "undefined") {
        const chart_data = localStorage.getItem("chart_data");
        if (chart_data) {
            return Promise.resolve(JSON.parse(chart_data));
        }
    }
    return retrieve_chart_data();
}
 
function retrieve_chart_data() {
    const last_value = localStorage.getItem("last_value");
    if (last_value == null){
        last_value = 0
    }
    return send_form("/get_chart_data", {
        last_value: last_value,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                localStorage.setItem("chart_data", JSON.stringify(raw_data));
                return raw_data;
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}
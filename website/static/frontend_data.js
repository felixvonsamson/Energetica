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

function load_chart_data() {
    if (typeof(Storage) !== "undefined") {
        const chart_data = sessionStorage.getItem("chart_data");
        if (chart_data) {
            const last_value = JSON.parse(sessionStorage.getItem("last_value"));
            var currentDate = new Date();
            var last_date = new Date(last_value["time"]);
            if (currentDate.getTime() - last_date.getTime() > 120000){
                return retrieve_chart_data();
            }
            return Promise.resolve(JSON.parse(chart_data));
        }
    }
    return retrieve_chart_data();
}
 
function retrieve_chart_data() {
    return fetch("/get_chart_data")
        .then((response) => response.json())
        .then((raw_data) => {
            var currentDate = new Date();
            sessionStorage.setItem("last_value", JSON.stringify({"total_t" : raw_data["total_t"], "time": currentDate}));
            sessionStorage.setItem("chart_data", JSON.stringify(raw_data["data"]));
            return raw_data["data"];
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}
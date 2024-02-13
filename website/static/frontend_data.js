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
            if (currentDate.getTime() - last_date.getTime() > 180000){
                return retrieve_chart_data(last_value["total_t"], chart_data);
            }
            return Promise.resolve(JSON.parse(chart_data));
        }
    }
    return retrieve_chart_data(0, false);
}
 
function retrieve_chart_data(total_t, chart_data) {
    return send_form("/get_chart_data", {
        last_value: total_t,
    })
        .then((response) => response.json())
        .then((raw_data) => {
            var currentDate = new Date();
            sessionStorage.setItem("last_value", JSON.stringify({"total_t" : raw_data["total_t"], "time": currentDate}));
            if (chart_data){
                let data = JSON.parse(chart_data);
                new_data = raw_data["data"];
                for(var key in new_data){
                    for(var subkey in new_data[key]){
                        if (!(subkey in data[key])){
                            data[key][subkey] = [];
                            for (var i = 0; i < 4; i++) {
                                data[key][subkey].push(Array(1440).fill(0));
                            }
                        }
                        for (var i = 0; i < 4; i++) {
                            data[key][subkey][i].splice(0, new_data[key][subkey][i].length);
                            data[key][subkey][i].push(...new_data[key][subkey][i]);
                        }
                    }
                }
                sessionStorage.setItem("chart_data", JSON.stringify(data));
                return data;
            }else{
                sessionStorage.setItem("chart_data", JSON.stringify(raw_data["data"]));
                return raw_data["data"];
            }
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}
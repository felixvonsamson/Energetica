/* 
This code contains the functions to acess frontend data and retreive it if it is not avalable. 
*/

function load_constructions() {
    if (typeof(Storage) !== "undefined") {
        const constructionsData = localStorage.getItem("constructions");
        if (constructionsData) {
            return Promise.resolve(JSON.parse(constructionsData));
        } else {
            return retrieve_constructions();
        }
    } else {
        return retrieve_constructions();
    }
    
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
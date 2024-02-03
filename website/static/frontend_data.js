/* 
This code contains the functions to acess frontend data and retreive it if it is not avalable. 
*/

function load_constructions() {
    const constructionsData = sessionStorage.getItem("constructions");
    if (constructionsData) {
        return JSON.parse(constructionsData);
    } else {
        return retrieve_constructions();
    }
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

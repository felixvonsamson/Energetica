let sortedNames;

fetch("/get_networks") // retrieves list of all networks using api.py
  .then((response) => response.json())
  .then((data) => {
    sortedNames = data.sort();
    if(sortedNames.length == 0){
        var warning = document.getElementById("warning");
        warning.innerHTML = "No network has been created yet, please create one.";
    }
    var selectElement = document.getElementById("choose_network");
    for(network of sortedNames){
        var option = document.createElement("option");
        option.value = network;
        option.text = network;
        selectElement.appendChild(option);
    }
  })
  .catch((error) => {
    console.log(error);
    console.error("Error:", error);
  });
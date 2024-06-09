let sortedNetworks;

fetch("/api/get_networks") // retrieves list of all networks using api.py
    .then((response) => response.json())
    .then((data) => {
        sortedNetworks = data.sort();
        if (sortedNetworks.length == 0) {
            var warning = document.getElementById("warning");
            warning.innerHTML =
                '<div class="medium toast error txt_center margin" \
        style="padding:8px 16px">No network has been created yet, \
        please create one.</div>';
            var joinNetworkForm = document.getElementById("join_network_form");
            joinNetworkForm.style.display = "none";
        }
        var selectElement = document.getElementById("choose_network");
        for (network of sortedNetworks) {
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

let sortedNames;
let invitations = [];


load_players().then((players_) => {
    const player_id = sessionStorage.getItem("player_id")
    const usernames = Object.entries(players_)
        .filter(([id, user]) => id != player_id)
        .map(([id, user]) => user.username);
    sortedNames = usernames.sort();
});

let input = document.getElementById("invite_player");

if(input){
    input.addEventListener("keyup", (e) => {
        //Initially remove all elements (so if user erases a letter or adds new letter then clean previous outputs)
        removeElements();
        for (let i of sortedNames) {
            //convert input to lowercase and compare with each string
            if (invitations.includes(i)) {
                continue;
            }
            if (i.toLowerCase().startsWith(input.value.toLowerCase())) {
                let listItem = document.createElement("li");
                listItem.classList.add("suggestions-items", "white", "medium");
                listItem.style.cursor = "pointer";
                listItem.setAttribute("onclick", "displayNames('" + i + "')");
                //Display matched part in bold
                let word = "<b>" + i.substr(0, input.value.length) + "</b>";
                word += i.substr(input.value.length);
                //display the value in array
                listItem.innerHTML = word;
                document.querySelector(".suggestions").appendChild(listItem);
            }
        }
    });
}

function displayNames(value) {
    input.value = value;
    removeElements();
}

function removeElements() {
    //clear all the item
    let items = document.querySelectorAll(".suggestions-items");
    items.forEach((item) => {
        item.remove();
    });
}

function addPlayer() {
    let player = input.value;
    //add player to the goup members only if they actually exist
    if (sortedNames.includes(player) && !invitations.includes(player)) {
        invitations.push(player);
        let groupMember = document.createElement("li");
        groupMember.classList.add("group_member");
        groupMember.style.cursor = "pointer";
        groupMember.setAttribute("id", "groupMember_" + player); //so that they can be removed afretwards
        groupMember.setAttribute("onclick", "removePlayer('" + player + "')");
        groupMember.innerHTML = player;
        document.querySelector(".invited_players").appendChild(groupMember);
        input.value = "";
    } else {
        addError("This player is already in the list or doesn't exist");
    }
}

function removePlayer(name) {
    //remove one of the group members
    invitations = invitations.filter((i) => i != name);
    document.getElementById("groupMember_" + name).remove();
}
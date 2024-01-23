/* 
This code creates a list of suggestions when typing names in a field
*/

let active_chat = 1;
let sortedNames;
let group = [];

fetch("/get_usernames") // retrieves list of all names using api.py
    .then((response) => response.json())
    .then((data) => {
        sortedNames = data.sort();
    })
    .catch((error) => {
        console.log(error);
        console.error("Error:", error);
    });

let input1 = document.getElementById("add_chat_username");
let input2 = document.getElementById("add_player");

input1.addEventListener("input", (e) => {
    //Initially remove all elements (so if user erases a letter or adds new letter then clean previous outputs)
    removeElements();
    for (let i of sortedNames) {
        //convert input to lowercase and compare with each string
        if (i.toLowerCase().startsWith(input1.value.toLowerCase())) {
            let listItem = document.createElement("li");
            listItem.classList.add("suggestions-items", "white", "medium");
            listItem.style.cursor = "pointer";
            listItem.setAttribute("onclick", "displayNames1('" + i + "')");
            //Display matched part in bold
            let word = "<b>" + i.substr(0, input1.value.length) + "</b>";
            word += i.substr(input1.value.length);
            //display the value in array
            listItem.innerHTML = word;
            document.querySelector(".suggestions1").appendChild(listItem);
        }
    }
});

input2.addEventListener("input", (e) => {
    //Initially remove all elements (so if user erases a letter or adds new letter then clean previous outputs)
    removeElements();
    for (let i of sortedNames) {
        //convert input to lowercase and compare with each string
        if (group.includes(i)) {
            continue;
        }
        if (i.toLowerCase().startsWith(input2.value.toLowerCase())) {
            let listItem = document.createElement("li");
            listItem.classList.add("suggestions-items", "white", "medium");
            listItem.style.cursor = "pointer";
            listItem.setAttribute("onclick", "displayNames2('" + i + "')");
            //Display matched part in bold
            let word = "<b>" + i.substr(0, input2.value.length) + "</b>";
            word += i.substr(input2.value.length);
            //display the value in array
            listItem.innerHTML = word;
            document.querySelector(".suggestions2").appendChild(listItem);
        }
    }
});

function displayNames1(value) {
    input1.value = value;
    removeElements();
}

function displayNames2(value) {
    input2.value = value;
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
    let player = input2.value;
    //add player to the goup members only if they actually exist
    if (sortedNames.includes(player) && !group.includes(player)) {
        group.push(player);
        let groupMember = document.createElement("li");
        groupMember.classList.add("group_member");
        groupMember.style.cursor = "pointer";
        groupMember.setAttribute("id", "groupMember_" + player); //so that they can be removed afretwards
        groupMember.setAttribute("onclick", "removePlayer('" + player + "')");
        groupMember.innerHTML = player;
        document.querySelector(".group_members").appendChild(groupMember);
        input2.value = "";
    } else {
        addError("This player is already in the list or doesn't exist");
    }
}

function removePlayer(name) {
    //remove one of the group members
    group = group.filter((i) => i != name);
    document.getElementById("groupMember_" + name).remove();
}

function createGroupChat() {
    let title = document.getElementById("chat_title").value;
    if (title.length == 0 || title.length > 25) {
        addError(
            "The chat title cannot be empty and cannot have more than 25 characters"
        );
        return;
    }
    if (group.length == 0) {
        addError("The chat has to have at least 2 members");
        return;
    }
    socket.emit("create_group_chat", title, group);
}

function openChat(chatID) {
    active_chat = chatID;
    let html = ``;
    fetch(`/get_chat?chatID=${chatID}`)
        .then((response) => response.json())
        .then((data) => {
            for (let i = 0; i < Math.min(25, data.length); i++) {
                html += `<div>${data[i][0]} : ${data[i][1]}</div>`;
            }
            document.getElementById("messages_field").innerHTML = html;
        })
        .catch((error) => {
            console.log(error);
            console.error("Error:", error);
        });
}

function sendMessage() {
    let message = document.getElementById("new_message").value;
    if (message.length == 0) {
        return;
    }
    document.getElementById("new_message").value = "";
    socket.emit("new_message", message, active_chat);
}

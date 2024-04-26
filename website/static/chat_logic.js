/* 
This code creates a list of suggestions when typing names in a field
*/

let chats;
let sortedNames;
let group = [];

fetch("/get_chat_list")
    .then((response) => response.json())
    .then((chat_list) => {
        chats = chat_list;
        let chat_list_container = document.getElementById("chat_list_container");
        chat_list_container.innerHTML = "";
        for(chat_id in chats){
            chat_list_container.innerHTML += `<div onclick="openChat(${chat_id})" class="margin-small white button">
                <div class="proile-icon green large">${chats[chat_id].name[0]}</div>
                <b class="medium padding test">${chats[chat_id].name}</b>
            </div>`
        }
    })
    .catch((error) => {
        console.error("Error:", error);
    });

load_players().then((players_) => {
    const player_id = sessionStorage.getItem("player_id")
    const usernames = Object.entries(players_)
        .filter(([id, user]) => id != player_id)
        .map(([id, user]) => user.username);
    sortedNames = usernames.sort();
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
    let hidden_input = document.getElementById("chat_id");
    hidden_input.value = chatID;
    let html = ``;
    fetch(`/get_chat_messages?chatID=${chatID}`)
        .then((response) => response.json())
        .then((data) => {
            load_players().then((players) => {
                for (let i = 0; i < data.length; i++) {
                    html += `<div>${formatDateString(data[i].time)}</div>
                    <div> ${players[data[i].player_id].username} : ${data[i].text}</div>`;
                }
                document.getElementById("messages_field").innerHTML = html;
            })
        })
        .catch((error) => {
            console.log(error);
            console.error("Error:", error);
        });
}

function formatDateString(dateString) {
    var [, day, month, year, time] = dateString.match(/(\d{2}) (\w{3}) (\d{4}) (\d{2}:\d{2}:\d{2})/);
    var date = new Date(year, new Date().getMonth(month), day, time.substring(0, 2), time.substring(3, 5));
    var currentDate = new Date();
    if (date.toDateString() === currentDate.toDateString()) {
        return date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris'});
    } else {
        var formattedDate = date.getDate() + ' ' + date.toLocaleString('default', { month: 'short' }) + '. ' +
                            date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris'});
        return formattedDate;
    }
}

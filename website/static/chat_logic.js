/* 
This code creates a list of suggestions when typing names in a field
*/

let chats;
let sortedNames;
let group = [];
let current_chat_id;

refresh_chats();

load_players().then((players_) => {
    const player_id = sessionStorage.getItem("player_id")
    const usernames = Object.entries(players_)
        .filter(([id, user]) => id != player_id)
        .map(([id, user]) => user.username);
    sortedNames = usernames.sort();
});

function refresh_chats(){
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
}

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

//Enter to add player to list
input2.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        addPlayer();
    }
});

//Enter to send message
let message_input = document.getElementById("new_message");
message_input.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        newMessage();
    }
});

function displayNames1(value) {
    input1.value = value;
    removeElements();
}

function displayNames2(value) {
    input2.value = value;
    removeElements();
    addPlayer();
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

function hide_disclaimer(){
    checkmark = document.getElementById("dont_show_disclaimer")
    if(checkmark.checked){
        fetch("/hide_chat_disclaimer")
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
    }
    document.getElementById('disclamer').classList.add('hidden');
}

function createChat(){
    username = document.getElementById("add_chat_username").value
    send_form("/create_chat", {
        buddy_username: username,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                refresh_chats();
                document.getElementById('add_chat').classList.add('hidden');
            }else if(response == "cannotChatWithYourself"){
                addError("Cannot create a chat with yourself");
            }else if(response == "usernameIsWrong"){
                addError("No Player with this username");
            }else if(response == "chatAlreadyExist"){
                addError("This chat already exists");
            }
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
    });
}

function createGroupChat() {
    let title = document.getElementById("chat_title").value;
    send_form("/create_group_chat", {
        chat_title: title,
        group_memebers: group,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                refresh_chats();
                document.getElementById('add_group_chat').classList.add('hidden');
                group = [];
            }else if(response == "wrongTitleLength"){
                addError("The chat title cannot be empty and cannot have more than 25 characters");
            }else if(response == "groupTooSmall"){
                addError("Group chats have to have at least 3 members");
            }else if(response == "chatAlreadyExist"){
                addError("This chat already exists");
            }
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
    });
}

function newMessage(){
    let message_field = document.getElementById("new_message");
    if (!current_chat_id){
        addError("No chat has been selected")
    }
    send_form("/new_message", {
        new_message: message_field.value,
        chat_id: current_chat_id,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                message_field.value = "";
            }
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
    });
}

function openChat(chatID) {
    current_chat_id = chatID;
    let html = ``;
    fetch(`/get_chat_messages?chatID=${chatID}`)
        .then((response) => response.json())
        .then((data) => {
            load_players().then((players) => {
                let chat_title = document.getElementById("chat_title_div");
                chat_title.innerHTML = `<b>${chats[chatID].name}</b>`;
                document.getElementById("message_input_field").classList.remove("hidden");
                for (let i = 0; i < data.length; i++) {
                    let alignment = "left";
                    let username = "";
                    if(data[i].player_id == sessionStorage.getItem("player_id")){
                        alignment = "right";
                    }else if(chats[chatID].group_chat){
                        username = players[data[i].player_id].username + "&emsp;";
                    }
                    html += `<div class="message ${alignment}">
                        <div class="message_infos">
                            <span>${username}</span>
                            <span class="txt_pine">${formatDateString(data[i].time)}</span></div>
                        <div class="message_text bone ${alignment}">${data[i].text}</div>
                    </div>`;
                }
                let message_container = document.getElementById("message_container")
                message_container.innerHTML = html;
                message_container.scrollTop = message_container.scrollHeight;
                document.getElementById("new_message").focus();
            })
        })
        .catch((error) => {
            console.log(error);
            console.error("Error:", error);
        });
}

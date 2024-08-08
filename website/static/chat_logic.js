/* 
This code creates a list of suggestions when typing names in a field
*/

let sortedNames;
let group = [];
let current_chat_id;

refresh_chats();

/* Load all players and sort them by username */
load_players().then((players_) => {
    const player_id = sessionStorage.getItem("player_id")
    const playerArray = Object.entries(players_)
        .filter(([id, user]) => id != player_id)
        .map(([id, user]) => ({ id, username: user.username }));
    playerArray.sort((a, b) => a.username.localeCompare(b.username));
    sortedNames = playerArray;
});

function refresh_chats() {
    /* Retrieves chat list and displays it. Displays unread badges and opens last opened chat. */
    load_chats().then((data) => {
        let chats = data.chat_list;
        let chat_list_container = document.getElementById("chat_list_container");
        chat_list_container.innerHTML = "";
        for (chat_id in chats) {
            badge = ""
            if (chats[chat_id].unread_messages > 0) {
                badge = `<span id="unread_badge_chat" class="unread_badge messages padding-small pine">${chats[chat_id].unread_messages}</span>`
            }
            let profile_icon;
            if (chat_id == 1) {
                profile_icon = '<div class="profile-icon green large"><i class="fa fa-star"></i></div>'
            } else if (chats[chat_id].group_chat) {
                profile_icon = '<div class="profile-icon green">';
                for (let initial of chats[chat_id].initials) {
                    profile_icon += `<span class="small_letter">${initial}</span>`
                }
                profile_icon += "</div>"
            } else {
                profile_icon = `<div class="profile-icon green large">${chats[chat_id].initials}</div>`
            }
            chat_list_container.innerHTML += `<div id="chat_${chat_id}" onclick="openChat(${chat_id})" class="margin-small white button position_relative flex-row">
                ${profile_icon}
                <b class="medium padding txt_overflow-hidden">${chats[chat_id].name}</b>
                ${badge}
                </div>`
        }
        openChat(data.last_opened_chat);
    }).catch((error) => {
        console.error("Error:", error);
    });
}

let input1 = document.getElementById("add_chat_username");
let input2 = document.getElementById("add_player");

input1.addEventListener("input", (e) => {
    /* interactive search for a player to write a message to */
    removeElements();
    const input_value = input1.value.toLowerCase();
    for (let player of sortedNames) {
        const username = player.username.toLowerCase();
        //compare input with each username in the sorted list
        if (username.startsWith(input_value)) {
            let listItem = document.createElement("li");
            listItem.classList.add("suggestions-items", "white", "medium");
            listItem.style.cursor = "pointer";
            listItem.setAttribute("onclick", `displayNames1('${player.id}')`);
            //Display matched part in bold
            let word = `<b>${player.username.substr(0, input_value.length)}</b>`;
            word += player.username.substr(input_value.length);
            //display the value in array
            listItem.innerHTML = word;
            document.querySelector(".suggestions1").appendChild(listItem);
        }
    }
});

input2.addEventListener("input", (e) => {
    /* interactive search for a player to add to a group chat */
    removeElements();
    const inputValue = input2.value.toLowerCase();
    for (let player of sortedNames) {
        const username = player.username.toLowerCase();
        //convert input to lowercase and compare with each string
        if (group.includes(player.id)) {
            continue;
        }
        if (username.startsWith(inputValue)) {
            let listItem = document.createElement("li");
            listItem.classList.add("suggestions-items", "white", "medium");
            listItem.style.cursor = "pointer";
            listItem.setAttribute("onclick", `displayNames2('${player.id}')`);
            //Display matched part in bold
            let word = `<b>${player.username.substr(0, inputValue.length)}</b>`;
            word += player.username.substr(inputValue.length);
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

function displayNames1(id) {
    const username = sortedNames.find(player => player.id === id).username;
    input1.value = username;
    removeElements();
}

function displayNames2(id) {
    const username = sortedNames.find(player => player.id === id).username;
    input2.value = username;
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
    /* Add a player to the list of group chat members */
    const inputUsername = input2.value;
    const playerObj = sortedNames.find(player => player.username === inputUsername);
    //add player to the group members only if they actually exist
    if (playerObj === undefined) {
        addError("This player does not exist");
        return;
    }
    if (group.some(memberId => memberId === playerObj.id)) {
        addError("This player is already in the list");
        return;
    }
    group.push(playerObj.id);
    let groupMember = document.createElement("li");
    groupMember.classList.add("group_member");
    groupMember.style.cursor = "pointer";
    groupMember.setAttribute("id", "groupMember_" + playerObj.id); //so that they can be removed afterwards
    groupMember.setAttribute("onclick", `removePlayer('${playerObj.id}')`);
    groupMember.innerHTML = playerObj.username;
    document.querySelector(".group_members").appendChild(groupMember);
    input2.value = "";
    removeElements();
}

function removePlayer(id) {
    /* Remove a player from the list of group chat members */
    group = group.filter((i) => i != id);
    document.getElementById("groupMember_" + id).remove();
}

function hide_disclaimer() {
    /* Hide the chat disclaimer and send the "dont show again" information to the server */
    let checkbox = document.getElementById("dont_show_disclaimer")
    if (checkbox.checked) {
        fetch("/api/hide_chat_disclaimer")
            .catch((error) => {
                console.error(`caught error ${error}`);
            });
    }
    document.getElementById('disclaimer').classList.add('hidden');
}

function getIdByUsername(username) {
    /* Get the player ID from its username */
    for (let player of sortedNames) {
        if (player.username === username) {
            return player.id;
        }
    }
    return null;
}

async function createChat() {
    /* Create a chat with a player */
    const username = document.getElementById("add_chat_username").value
    const buddy_id = getIdByUsername(username)
    if (buddy_id == null) {
        addError("No Player with this username");
        return;
    }

    try {
        const response = await send_form("/api/create_chat", { buddy_id: buddy_id });
        const raw_data = await response.json();
        const responseMessage = raw_data["response"];

        if (responseMessage === "success") {
            retrieve_chats();
            document.getElementById('add_chat').classList.add('hidden');
        } else if (responseMessage === "cannotChatWithYourself") {
            addError("Cannot create a chat with yourself");
        } else if (responseMessage === "buddyIDDoesNotExist") {
            addError("This player does not exist");
        } else if (responseMessage === "chatAlreadyExist") {
            addError("This chat already exists");
        }
    } catch (error) {
        console.error(`caught error: ${error}`);
    }
}

function createGroupChat() {
    /* Create a group chat with the selected players */
    let title = document.getElementById("chat_title").value;
    send_form("/api/create_group_chat", {
        chat_title: title,
        group_members: group,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                retrieve_chats();
                document.querySelector(".group_members").innerHTML = "";
                document.getElementById('add_group_chat').classList.add('hidden');
                group = [];
            } else if (response == "wrongTitleLength") {
                addError("The chat title cannot be empty and cannot have more than 25 characters");
            } else if (response == "groupTooSmall") {
                addError("Group chats have to have at least 3 members");
            } else if (response == "chatAlreadyExist") {
                addError("This chat already exists");
            }
        });
    })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function newMessage() {
    /* Send a new message to the current chat */
    let message_field = document.getElementById("new_message");
    if (!current_chat_id) {
        addError("No chat has been selected")
    }
    send_form("/api/new_message", {
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
    /* Open a chat and display its messages */
    current_chat_id = chatID;
    let html = ``;
    load_chats().then((chat_data) => {
        let chats = chat_data.chat_list;
        if (chat_data.chat_list[chatID].unread_messages > 0) {
            chat_data.chat_list[chatID].unread_messages = 0
            chat_data.unread_chats -= 1;
            document.getElementById(`chat_${chatID}`).querySelector("#unread_badge_chat").classList.add("hidden");
        }
        chat_data.last_opened_chat = chatID;
        sessionStorage.setItem("chats", JSON.stringify(chat_data));
        show_unread_badges();
        fetch(`/api/get_chat_messages?chatID=${chatID}`)
            .then((response) => response.json())
            .then((data) => {
                load_players().then((players) => {
                    let messages = data.messages;
                    let chat_title = document.getElementById("chat_title_div");
                    chat_title.innerHTML = `<b>${chats[chatID].name}</b>`;
                    document.getElementById("message_input_field").classList.remove("hidden");
                    for (let i = 0; i < messages.length; i++) {
                        let alignment = "left";
                        let username = "";
                        if (messages[i].player_id == sessionStorage.getItem("player_id")) {
                            alignment = "right";
                        } else if (chats[chatID].group_chat) {
                            username = players[messages[i].player_id].username + "&emsp;";
                        }
                        html += `<div class="message ${alignment}">
                        <div class="message_infos">
                            <span>${username}</span>
                            <span class="txt_pine">${formatDateString(messages[i].time)}</span></div>
                        <div class="message_text bone ${alignment}">${messages[i].text}</div>
                    </div>`;
                    }
                    let message_container = document.getElementById("message_container")
                    message_container.innerHTML = html;
                    message_container.scrollTop = message_container.scrollHeight;
                    document.getElementById("new_message").focus();
                })
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    });
}

/* 
This code creates a list of suggestions when typing names in a field
*/

// @type { typeof import('./frontend_data.js').load_players; }

let sortedNames;
let group = [];
let current_chat_id;

refresh_chats();

/* Load all players and sort them by username */
load_players().then((players_) => {
    load_player_id().then((player_id) => {
        const playerArray = Object.entries(players_)
            .filter(([id, user]) => id != player_id)
            .map(([id, user]) => ({ id, username: user.username }));
        playerArray.sort((a, b) => a.username.localeCompare(b.username));
        sortedNames = playerArray;
    });
});

function refresh_chats() {
    /* Retrieves chat list and displays it. Displays unread badges and opens last opened chat. */
    load_chats().then((chat_data) => {
        let chats = chat_data.chats;
        let chat_list_container = document.getElementById("chat_list_container");
        chat_list_container.innerHTML = "";
        for (let chat of chats) {
            badge = "";
            if (chat.unread_messages_count > 0) {
                badge = `<span id="unread_badge_chat" class="unread_badge messages padding-small pine">${chat.unread_messages_count}</span>`;
            }
            let profile_icon;
            if (chat.id == 1) {
                profile_icon = '<div class="profile-icon green large"><i class="fa fa-star"></i></div>';
            } else if (chat.group_chat) {
                profile_icon = '<div class="profile-icon green">';
                for (let initial of chat.initials) {
                    profile_icon += `<span class="small_letter">${initial}</span>`;
                }
                profile_icon += "</div>";
            } else {
                profile_icon = `<div class="profile-icon green large">${chat.initials}</div>`;
            }
            chat_list_container.innerHTML += `<div id="chat_${chat.id}" onclick="openChat(${chat.id})" class="margin-small white button position_relative flex-row">
                ${profile_icon}
                <b class="medium padding txt_overflow-hidden">${chat.display_name}</b>
                ${badge}
                </div>`;
        }
        if (chat_data.last_opened_chat_id == null) {
            chat_data.last_opened_chat_id = chats[0].id;
        }
        openChat(chat_data.last_opened_chat_id);
    }).catch((error) => {
        console.error("Error:", error);
    });
}

let input1 = document.getElementById("add_chat_7bca9");
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
    let checkbox = document.getElementById("dont_show_disclaimer");
    if (checkbox.checked) {
        fetch("/api/v1/players/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ show_disclaimer: false }),
        },);
    }
    document.getElementById('disclaimer').classList.add('hidden');
}

function getIdByUsername(username) {
    /* Get the player ID from its username */
    // WARN: this function returns a string, not a number
    for (let player of sortedNames) {
        if (player.username === username) {
            return player.id;
        }
    }
    return null;
}

async function createChat() {
    /* Create a chat with a player */
    const username = document.getElementById("add_chat_7bca9").value;
    const buddy_id = getIdByUsername(username);
    if (buddy_id == null) {
        addError("No Player with this username");
        return;
    }

    try {
        const response = await send_json("/api/v1/chats", { group_member_ids: [Number(buddy_id)] });

        if (response.status == 204) {
            // No content, chat created successfully
            retrieve_chats();
            document.getElementById('add_chat').classList.add('hidden');
        } else if (response.status == 400) {
            response.json().then((raw_data) => {
                const description = {
                    "chatAlreadyExist": "This chat already exists",
                    "cannotChatWithYourself": "You cannot create a chat with yourself",
                    "buddyIDDoesNotExist": "This player does not exist",
                }[raw_data["exception_type"]];
                if (description) {
                    addError(description);
                } else {
                    addError("An unknown error occurred");
                }
            });
        }
    } catch (error) {
        console.error(`caught error: ${error}`);
    }
}

function createGroupChat() {
    /* Create a group chat with the selected players */
    let title = document.getElementById("chat_title").value;
    send_json("/api/v1/chats", {
        group_chat_name: title,
        group_member_ids: group,
    }).then((response) => {
        if (response.status == 204) {
            retrieve_chats();
            document.querySelector(".group_members").innerHTML = "";
            document.getElementById('add_group_chat').classList.add('hidden');
            group = [];
        } else if (response.status == 400) {
            response.json().then((raw_data) => {
                const description = {
                    "wrongTitleLength": "The chat title cannot be empty and cannot have more than 25 characters",
                    "groupTooSmall": "Group chats have to have at least 3 members",
                    "chatAlreadyExist": "This chat already exists",
                }[raw_data["exception_type"]];
                if (description) {
                    addError(description);
                } else {
                    addError("An unknown error occurred");
                }
            });
        }
    })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function newMessage() {
    /* Send a new message to the current chat */
    let message_field = document.getElementById("new_message");
    if (!current_chat_id) {
        addError("No chat has been selected");
    }
    send_json(`/api/v1/chats/${current_chat_id}/messages`, {
        new_message: message_field.value,
    }).then((response) => {
        response.json().then((raw_data) => {
            if (response.status === 200) {
                message_field.value = "";
            } else if (response.status === 422) {
                addError("Message cannot be empty or too long");
            }
        });
    })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function openChat(chatID) {
    /* Open a chat and display its messages */
    current_chat_id = chatID;
    let html = ``;
    load_chats().then((chat_data) => {
        let chats = chat_data.chats;
        const chat = chats.find(chat => chat.id == chatID);
        if (chat.unread_messages_count > 0) {
            chat.unread_messages_count = 0;
            chat_data.unread_chats -= 1;
            document.getElementById(`chat_${chatID}`).querySelector("#unread_badge_chat").classList.add("hidden");
        }
        chat_data.last_opened_chat_id = chatID;
        sessionStorage.setItem("chats_data", JSON.stringify(chat_data));
        show_unread_badges();
        fetch(`/api/v1/chats/${chatID}/messages`)
            .then((response) => response.json())
            .then((data) => {
                load_players().then((players) => {
                    load_player_id().then((player_id) => {
                        let messages = data.messages;
                        let chat_title = document.getElementById("chat_title_div");
                        chat_title.innerHTML = `<b>${chat.display_name}</b>`;
                        document.getElementById("message_input_field").classList.remove("hidden");
                        for (let i = 0; i < messages.length; i++) {
                            let alignment = "left";
                            let username = "";
                            if (messages[i].player_id == player_id) {
                                alignment = "right";
                            } else if (chat.group_chat) {
                                username = players[messages[i].player_id].username + "&emsp;";
                            }
                            html += `<div class="message ${alignment}">
                        <div class="message_infos">
                            <span>${username}</span>
                            <span class="txt_pine">${formatDateString(messages[i].timestamp)}</span></div>
                        <div class="message_text bone ${alignment}">${escapeHTML(messages[i].text)}</div>
                    </div>`;
                        }
                        let message_container = document.getElementById("message_container");
                        message_container.innerHTML = html;
                        message_container.scrollTop = message_container.scrollHeight;
                        document.getElementById("new_message").focus();
                    });
                });
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    });
    fetch("/api/v1/players/settings", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ last_opened_chat_id: chatID }),
    })
        .then((response) => {
            if (response.status !== 204) {
                console.error("Error:", response.status);
            }
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

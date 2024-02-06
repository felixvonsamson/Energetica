/* 
This code generates the progress bars on top of the pages that show the facilities under construction
*/

function formatMilliseconds(totalSeconds) {
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    let formattedTime = "";
    if (days > 0) {
        formattedTime += `${days}d `;
    }
    if (days > 0 || hours > 0) {
        formattedTime += `${hours}h `;
    }
    if (days > 0 || hours > 0 || minutes > 0) {
        formattedTime += `${minutes}m `;
    }
    formattedTime += `${seconds}s`;

    return formattedTime.trim();
}

function cancel_construction(construction_id) {
    send_form("/request_cancel_project", {
        id: construction_id,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    let money = raw_data["money"];
                    var obj = document.getElementById("money");
                    obj.innerHTML = formatted_money(money);
                    addToast("Construction cancelled");
                    sessionStorage.setItem(
                        "constructions",
                        JSON.stringify(raw_data["constructions"])
                    );
                    refresh_progressBar();
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function pause_construction(construction_id) {
    send_form("/request_pause_project", {
        id: construction_id,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    sessionStorage.setItem(
                        "constructions",
                        JSON.stringify(raw_data["constructions"])
                    );
                    refresh_progressBar();
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function increase_project_priority(construction_id) {
    send_form("/request_increase_project_priority", {
        id: construction_id,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    sessionStorage.setItem(
                        "constructions",
                        JSON.stringify(raw_data["constructions"])
                    );
                    refresh_progressBar();
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

const progressBars = document.getElementsByClassName("progressbar-bar");
let constructions_data;
load_constructions().then((constructions) => {
    constructions_data = constructions;
    setInterval(() => {
        for (const progressBar of progressBars) {
            const id = progressBar.id;
            const construction = constructions_data[0][id];
            const now = new Date().getTime() / 1000;
            let new_width;
            let time_remaining;
            if (construction["suspension_time"]) {
                new_width =
                    ((construction["suspension_time"] -
                        construction["start_time"]) /
                        construction["duration"]) *
                    100;
                time_remaining =
                    construction["duration"] +
                    construction["start_time"] -
                    construction["suspension_time"];
            } else {
                new_width =
                    ((now - construction["start_time"]) /
                        construction["duration"]) *
                    100;
                time_remaining =
                    construction["duration"] + construction["start_time"] - now;
            }
            progressBar.style.setProperty("--width", new_width);
            if (new_width > 0.01) {
                progressBar.classList.add("pine");
            }
            const time = formatMilliseconds(time_remaining);
            progressBar.innerHTML = "&nbsp; " + time;
        }
    }, 50);
});

function refresh_progressBar() {
    const uc = document.getElementById("under_construction");
    uc.innerHTML = "";
    load_constructions().then((construction_list) => {
        constructions_data = construction_list;
        construction_priority = construction_list[1];
        for (const [index, c_id] of construction_priority.entries()) {
            construction = construction_list[0][c_id];
            if (
                (construction["family"] == document.title) |
                (document.title == "Home")
            ) {
                let play_pause_logo = "fa-pause";
                if (construction["suspension_time"]) {
                    play_pause_logo = "fa-play";
                }
                let html =
                    '<div class="progressbar-container">\
                    <div class="progressbar-arrowcontainer">';
                if (index > 0) {
                    html +=
                        '<button class="progressbar-arrow progressbar-button" onclick="increase_project_priority(' +
                        c_id +
                        ')">\
                        <i class="fa fa-caret-up"></i>\
                    </button>';
                }
                if (index + 1 != construction_priority.length) {
                    html +=
                        '<button class="progressbar-arrow progressbar-button" onclick="increase_project_priority(' +
                        construction_priority[index + 1] +
                        ')">\
                        <i class="fa fa-caret-down"></i>\
                    </button>';
                }
                html +=
                    '</div>\
                    <div class="progressbar-name medium margin-small">' +
                    construction["name"] +
                    '</div>\
                    <div class="progressbar-background">\
                    <div id="' +
                    c_id +
                    '" class="progressbar-bar"></div>\
                    </div>\
                    <button class="progressbar-icon progressbar-button" onclick="pause_construction(' +
                    c_id +
                    ')">\
                        <i class="fa ' +
                    play_pause_logo +
                    '"></i>\
                    </button>\
                    <button class="progressbar-icon progressbar-button" onclick="cancel_construction(' +
                    c_id +
                    ')">\
                        <i class="fa fa-times"></i>\
                    </button>\
                </div>';
                uc.innerHTML += html;
            }
        }
    });
}

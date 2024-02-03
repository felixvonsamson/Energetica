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

function cancel_construction(construction_id){
    send_form("/request_cancel_project", {
        id: construction_id
    })
    .then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                let money = raw_data["money"];
                var obj = document.getElementById("money");
                obj.innerHTML = formatted_money(money);
                addToast("Construction cancelled");
                refresh_progressBar();
            }
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
        });
}

function pause_construction(construction_id){
    send_form("/request_pause_project", {
        id: construction_id
    })
    .then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                refresh_progressBar();
            }
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
        });
}


const progressBars = document.getElementsByClassName('progressbar-bar')
let constructions = load_constructions()
setInterval(() => {
    //const constructions = load_constructions()
    for(const progressBar of progressBars){
        const id = progressBar.id;
        const construction = constructions[id];
        const now = new Date().getTime()/1000;
        let new_width;
        let time_remaining;
        if (construction["suspension_time"]){
            new_width = (construction["suspension_time"] - construction["start_time"]) / construction["duration"] * 100;
            time_remaining = construction["duration"] + construction["start_time"] - construction["suspension_time"];
        }else{
            new_width = (now - construction["start_time"]) / construction["duration"] * 100;
            time_remaining = construction["duration"] + construction["start_time"] - now;
        }
        progressBar.style.setProperty('--width', new_width);
        const time = formatMilliseconds(time_remaining);
        progressBar.innerText = time;
    }
}, 50)

function refresh_progressBar(){
    const uc = document.getElementById("under_construction");
    uc.innerHTML = ''
    retrieve_constructions().then((construction_list) => {
        constructions = construction_list;
        for (const [c_id, construction] of Object.entries(construction_list)){
            if (construction["family"] == document.title){
                let play_pause_logo = "fa-pause"
                if (construction["suspension_time"]){
                    play_pause_logo = "fa-play"
                }
                uc.innerHTML += '<div class="progressbar-container">\
                    <div class="progressbar-arrowcontainer">\
                    <button class="progressbar-arrow progressbar-button">\
                        <i class="fa fa-caret-up"></i>\
                    </button>\
                    <button class="progressbar-arrow progressbar-button">\
                        <i class="fa fa-caret-down"></i>\
                    </button>\
                    </div>\
                    <div class="progressbar-name medium margin-small">' + construction["name"] + '</div>\
                    <div class="progressbar-background">\
                    <div id="' + c_id + '" class="progressbar-bar pine"></div>\
                    </div>\
                    <button class="progressbar-icon progressbar-button" onclick="pause_construction(' + c_id + ')">\
                        <i class="fa ' + play_pause_logo + '"></i>\
                    </button>\
                    <button class="progressbar-icon progressbar-button" onclick="cancel_construction(' + c_id + ')">\
                        <i class="fa fa-times"></i>\
                    </button>\
                </div>'
            }
        }
      });
}
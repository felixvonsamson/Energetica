/* 
This code generates the progress bars on top of the pages that show the facilities under construction
*/

//CHANGE TO p5.js
function formatMilliseconds(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
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

const update_countdowns = () => {
    const matches = document.querySelectorAll(".time");
    matches.forEach((el) => {
        const finish_time = el.dataset.name;
        const now = new Date().getTime();
        if (finish_time * 1000 < now) {
            el.parentElement.style.display = "none";
        } else {
            const time = formatMilliseconds(finish_time * 1000 - now);
            el.innerText = `(${time})`;
        }
    });
};

//update_countdowns();
//setInterval(update_countdowns, 1000);

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
            }
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
        });
}

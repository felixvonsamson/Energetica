function addToast(message) {
    document.getElementById("toasts").innerHTML += `
        <div class="toast message medium">
            <i class="fa fa-info-circle info-circle"></i>
            <div class="txt_center">${message}</div>
            <span onclick="this.parentElement.style.display='none'" class="cross">&times;</span>
        </div>
        `;
}

function addError(message) {
    document.getElementById("toasts").innerHTML += `
        <div class="toast error medium">
            <i class="fa fa-exclamation-circle exclamation-circle"></i>
            <div class="txt_center">${message}</div>
            <span onclick="this.parentElement.style.display='none'" class="cross">&times;</span>
        </div>
        `;
}

function show_construction(name, locked){
    if (locked == "True"){
        addToast("This facility is not unlocked");
        return;
    }
    let tile = document.getElementById(name);
    let additionalContent = tile.querySelector("#constructionContent");

    if (additionalContent.classList.contains("hidden")) {
        additionalContent.classList.remove("hidden");
        additionalContent.classList.add("shown");
        additionalContent.style.maxWidth = null;
    } else {
        additionalContent.classList.remove("shown");
        additionalContent.classList.add("hidden");
        additionalContent.style.maxWidth = "500 px";
    }
}

function stopPropagation(event) {
    event.stopPropagation();
}

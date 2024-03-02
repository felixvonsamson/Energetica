function show_construction(name) {
    let tile = document.getElementById(name);
    let additionalContent = tile.querySelector("#constructionContent");
    let infotable = tile.querySelector("#infotable");
    let overlay = tile.querySelector('.overlay');

    if (additionalContent.classList.contains("hidden")) {
        additionalContent.classList.remove("hidden");
        additionalContent.classList.add("shown");
        additionalContent.style.maxHeight = null;

        infotable.classList.remove("minimized");
        infotable.classList.add("maximized");
        infotable.style.maxHeight = "250 px";

        overlay.classList.add('hidden');
    } else {
        additionalContent.classList.remove("shown");
        additionalContent.classList.add("hidden");
        additionalContent.style.maxHeight = "100 px";

        infotable.classList.remove("maximized");
        infotable.classList.add("minimized");
        infotable.style.maxHeight = "139 px";

        overlay.classList.remove('hidden');
    }
}

function stopPropagation(event) {
    event.stopPropagation();
}

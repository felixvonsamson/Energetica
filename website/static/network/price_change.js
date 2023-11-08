// Get a NodeList of all input elements
const inputElements = document.querySelectorAll('input');

// Add an input event listener to each input element
inputElements.forEach(input => {
    input.addEventListener('input', handleInputUpdate);
});

// Define the event handler function
function handleInputUpdate(event) {
    // Access the input element and its value
    const inputElement = event.target;
    const attribute = inputElement.id;
    if (inputElement.type == "checkbox"){
        // send change to server to update value
        console.log(attribute, inputElement.checked);
        socket.emit("change_price", attribute, inputElement.checked);
    }else{
        // send change to server to update value
        socket.emit("change_price", attribute, inputElement.value);
    }
}
function validateForm() {
    var x = document.forms["SM-myForm"]["SM-mForm"].placeholder;
    if (x == null || x == "") {
        alert("All the input fields with the * need to be filled out!");
        return false;
    }
    return true;
}

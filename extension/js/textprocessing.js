function processPageText(str) {
    return removeDiacritics(str).replace('[^a-zA-Z0-9-._~]',"").toLowerCase();
}

function removeDiacritics(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escape(str) {
    var ret = '';
    var i;
    for (i = 0; i < str.length; i++) {
        switch (str.charAt(i)) {
        case '"':
            ret += '&quot;';
            break;
        case '\'':
            ret += '&apos;';
            break;
        case '<':
            ret += '&lt;'
            break;
        case '>':
            ret += '&gt;'
            break;
        case '&':
            ret += '&amp;'
            break;
        default:
            ret += str.charAt(i);
        }
    }
    return ret;
}


// Butchered from https://github.com/andris9/mimelib/blob/master/mime-functions.js:

module.exports = function foldHeaderLine(str, maxLength, foldAnywhere, afterSpace) {
    var curpos = 0,
        response = "",
        lf;
    maxLength = maxLength || 78;

    // return original if no need to fold
    if (str.length <= maxLength) {
        return str;
    }

    var line;
    while (curpos < str.length) {
        // read in <maxLength> bytes and try to fold it
        line = str.substr(curpos, maxLength);
        if (foldAnywhere) {
            response += line;
            if (curpos + maxLength < str.length) {
                response += "\r\n";
            }
        } else {
            lf = line.lastIndexOf(" ");
            if (lf <= 0) {
                lf = line.lastIndexOf("\t");
            }
            if (line.length >= maxLength && lf > 0) {
                if (afterSpace) {
                    // move forward until line end or no more \s and \t
                    while (lf < line.length && (line.charAt(lf) === " " || line.charAt(lf) === "\t")) {
                        lf += 1;
                    }
                }
                response += line.substr(0, lf) + "\r\n";
                curpos -= line.substr(lf).length;
            } else {
                response += line;
            }
        }
        curpos += line.length;
    }

    return response;
};

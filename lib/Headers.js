var foldHeaderLine = require('./foldHeaderLine'),
    formatHeaderName = require('./formatHeaderName');

function Headers(objectOrString) {
    this.valuesByName = {};
    this.populate(objectOrString);
}

Headers.prototype.populate = function (objectOrString) {
    if (typeof objectOrString === 'string') {
        this.populateFromString(objectOrString);
    } else if (objectOrString && typeof objectOrString === 'object') {
        this.setAll(objectOrString);
   }
};

Headers.prototype.populateFromString = function (str) {
    var that = this,
        state = 'startLine',
        currentHeaderName = '',
        currentValue = '';

    function flush() {
        if (currentHeaderName.length > 0) {
            that.set(currentHeaderName, currentValue);
        }
        currentHeaderName = '';
        currentValue = '';
        state = 'startLine';
    }
    for (var i = 0 ; i < str.length ; i += 1) {
        var ch = str[i];
        if (state === 'startLine') {
            if (ch === ':') {
                state = 'startHeaderValue';
            } else if (ch === '\r' || ch === '\n') {
                // Parse error or terminating CRLFCRLF

                if (ch === '\r' && str[i + 1] === '\n' || (ch === '\n' && str[i + 1] === '\r')) {
                    i += 2;
                } else {
                    i += 1;
                }
                flush();
                return i;
            } else {
                currentHeaderName += ch;
            }
        } else if (state === 'startHeaderValue' || state === 'headerValue') {
            if (state === 'startHeaderValue') {
                if (ch === ' ') {
                    // Ignore space after :
                    continue;
                } else {
                    state = 'headerValue';
                }
            }
            if (ch === '\r') {
                if (str[i + 1] === '\n') {
                    if (/[ \t]/.test(str[i + 2])) {
                        // Skip past CRLF\s fold
                        i += 2;
                    } else {
                        i += 1;
                        flush();
                    }
                } else if (/[ \t]/.test(str[i + 1])) {
                    // Skip past CR\s fold
                    i += 1;
                } else {
                    flush();
                }
            } else if (ch === '\n') {
                if (str[i + 1] === '\r') {
                    if (/[ \t]/.test(str[i + 2])) {
                        // Skip past LFCR\s fold
                        i += 2;
                    } else {
                        i += 1;
                        flush();
                    }
                } else if (/[ \t]/.test(str[i + 1])) {
                    // Skip past LF\s fold
                    i += 1;
                } else {
                    flush();
                }
            } else {
                currentValue += ch;
            }
        }
    }
    flush();
    return i;
};

Headers.prototype.setAll = function (valuesByName) {
    Object.keys(valuesByName).forEach(function (headerName) {
        var value = valuesByName[headerName],
            headerNameLowerCase = headerName.toLowerCase();
        if (Array.isArray(value)) {
            this.valuesByName[headerNameLowerCase] = value.map(String);
        } else if (typeof value !== 'undefined') {
            this.valuesByName[headerNameLowerCase] = [String(value)];
        }
    }, this);
};

Headers.prototype.get = function (headerName, valueNumber) {
    valueNumber = valueNumber || 0;
    var values = this.valuesByName[headerName.toLowerCase()];
    if (values) {
        return values[valueNumber];
    }
};

Headers.prototype.getAll = function (headerName) {
    var values = this.valuesByName[headerName.toLowerCase()];
    if (values) {
        return [].concat(values);
    }
};

Headers.prototype.getNames = function (headerName) {
    return Object.keys(this.valuesByName);
};

Headers.prototype.count = function (headerName) {
    var values = this.valuesByName[headerName.toLowerCase()];
    if (values) {
        return values.length;
    } else {
        return 0;
    }
};

Headers.prototype.set = function (headerName, valueOrValues) {
    var headerNameLowerCase = headerName.toLowerCase();
    if (Array.isArray(valueOrValues)) {
        this.valuesByName[headerNameLowerCase] = valueOrValues.map(String);
    } else {
        (this.valuesByName[headerNameLowerCase] = this.valuesByName[headerNameLowerCase] || []).push(String(valueOrValues));
    }
};

Headers.prototype.remove = function (headerName, valueNumber) {
    var headerNameLowerCase = headerName.toLowerCase(),
        values = this.valuesByName[headerNameLowerCase];
    if (typeof valueNumber === 'undefined' || (values.length === 1 && valueNumber === 0)) {
        delete this.valuesByName[headerNameLowerCase];
    } else if (values) {
        values.splice(valueNumber, 1);
    }
};

Headers.prototype.equals = function (other) {
    var headerNames = this.getNames(),
        otherHeaderNames = other.getNames();
    if (headerNames.length !== otherHeaderNames.length) {
        return false;
    }
    headerNames.sort();
    otherHeaderNames.sort();
    for (var i = 0 ; i < headerNames.length ; i += 1) {
        var headerName = headerNames[i];
        if (headerName !== otherHeaderNames[i]) {
            return false;
        }
        var headerValues = this.getAll(headerName),
            otherHeaderValues = other.getAll(headerName);
        if (headerValues.length !== otherHeaderValues.length) {
            return false;
        }
        if (headerValues.length === 1 && otherHeaderValues.length === 1) {
            if (headerValues[0] !== otherHeaderValues[0]) {
                return false;
            }
        } else {
            headerValues.sort();
            otherHeaderValues.sort();
            for (var j = 0 ; j < headerValues.length ; j += 1) {
                if (headerValues[i] !== otherHeaderValues[i]) {
                    return false;
                }
            }
        }
    }
    return true;
};

Headers.prototype.toString = function (maxLineLength) {
    var result = '',
        lowerCaseHeaderNames = this.getNames();
    lowerCaseHeaderNames.forEach(function (lowerCaseHeaderName) {
        this.valuesByName[lowerCaseHeaderName].forEach(function (value) {
            result += foldHeaderLine(formatHeaderName(lowerCaseHeaderName) + ': ' + value + "\r\n", maxLineLength);
        });
    }, this);
    return result;
};

module.exports = Headers;

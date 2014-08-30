var foldHeaderLine = require('./foldHeaderLine'),
    formatHeaderName = require('./formatHeaderName'),
    isRegExp = require('./isRegExp');

function Headers(obj, doNotStringify) {
    this.valuesByName = {};
    this.populate(obj, doNotStringify);
}

Headers.prototype.populate = function (obj, doNotStringify) {
    if (typeof obj === 'string') {
        this.populateFromString(obj);
    } else if (obj && typeof obj === 'object') {
        if (obj instanceof Headers) {
            this.populateFromObject(obj.valuesByName, doNotStringify);
        } else {
            this.populateFromObject(obj, doNotStringify);
        }
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

Headers.prototype.populateFromObject = function (valuesByName, doNotStringify) {
    Object.keys(valuesByName).forEach(function (headerName) {
        var value = valuesByName[headerName],
            headerNameLowerCase = headerName.toLowerCase();
        if (Array.isArray(value)) {
            this.valuesByName[headerNameLowerCase] = doNotStringify ? [].concat(value) : value.map(String);
        } else if (typeof value !== 'undefined') {
            this.valuesByName[headerNameLowerCase] = doNotStringify ? [value] : [String(value)];
        }
    }, this);
};

Headers.prototype.clone = function () {
    var clone = new Headers();
    this.getNames().forEach(function (headerName) {
        clone.set(headerName, this.getAll(headerName));
    }, this);
    return clone;
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

Headers.prototype.remove = function (headerNameOrObj, valueOrValuesOrValueNumber) {
    var numRemoved = 0;
    if (headerNameOrObj && typeof headerNameOrObj === 'object') {
        Object.keys(headerNameOrObj).forEach(function (headerName) {
            numRemoved += this.remove(headerName, headerNameOrObj[headerName]);
        }, this);
        return numRemoved;
    }
    var headerNameLowerCase = headerNameOrObj.toLowerCase(),
        values = this.valuesByName[headerNameLowerCase];
    if (!values) {
        return 0;
    } else if (typeof valueOrValuesOrValueNumber === 'undefined') {
        delete this.valuesByName[headerNameLowerCase];
        return values.length;
    } else if (Array.isArray(valueOrValuesOrValueNumber)) {
        valueOrValuesOrValueNumber.forEach(function (value) {
            numRemoved += this.remove(headerNameLowerCase, value);
        }, this);
        return numRemoved;
    } else if (typeof valueOrValuesOrValueNumber === 'number') {
        if (values.length === 1 && valueOrValuesOrValueNumber === 0) {
            delete this.valuesByName[headerNameLowerCase];
            numRemoved = 1;
        } else if (valueOrValuesOrValueNumber < values.length) {
            values.splice(valueOrValuesOrValueNumber, 1);
            numRemoved = 1;
        }
    } else {
        var value = String(valueOrValuesOrValueNumber),
            index = values.indexOf(value);
        if (index !== -1) {
            if (index === 0 && values.length === 1) {
                delete this.valuesByName[headerNameLowerCase];
            } else {
                values.splice(index, 1);
            }
            numRemoved = 1;
        }
    }
    return numRemoved;
};

// has('Content-Length')
// has('Content-Type', 'text/html');
// has('Cookie', ['foo=bar', 'baz=quux']);
Headers.prototype.has = function (headerName, stringOrArrayOrRegExp) {
    var values = this.valuesByName[headerName.toLowerCase()];
    if (typeof stringOrArrayOrRegExp === 'undefined') {
        return !!values;
    } else if (typeof values === 'undefined') {
        return false;
    } else {
        if (Array.isArray(stringOrArrayOrRegExp)) {
            return stringOrArrayOrRegExp.every(function (expectedValue) {
                if (isRegExp(expectedValue)) {
                    return values.some(function (value) {
                        return expectedValue.test(value);
                    });
                } else {
                    return values.indexOf(String(expectedValue)) !== -1;
                }
            });
        } else {
            return values.length === 1 && values[0] === String(stringOrArrayOrRegExp);
        }
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

var foldHeaderLine = require('./foldHeaderLine'),
    formatHeaderName = require('./formatHeaderName');

function Headers(valuesByName) {
    this.valuesByName = {};
    if (valuesByName && typeof valuesByName === 'object') {
       this.setAll(valuesByName);
   }
}

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

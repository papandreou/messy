var Message = require('./Message'),
    util = require('util'),
    isRegExp = require('./isRegExp');

function HttpResponse(obj) {
    Message.call(this, obj);
}

HttpResponse.propertyNames = ['statusLine', 'protocol', 'protocolName', 'protocolVersion', 'statusCode', 'statusMessage'];

util.inherits(HttpResponse, Message);

HttpResponse.prototype.populate = function (obj) {
    Message.prototype.populate.call(this, obj);
    if (obj && typeof obj === 'object' && !Buffer.isBuffer(obj)) {
        this.populateFromObject(obj);
    }
};

HttpResponse.prototype.populateFromObject = function (obj) {
    Message.prototype.populateFromObject.call(this, obj);
    HttpResponse.propertyNames.forEach(function (propertyName) {
        if (typeof obj[propertyName] !== 'undefined') {
            this[propertyName] = obj[propertyName];
        }
    }, this);
};

HttpResponse.prototype.populateProtocolFromString = function (protocol) {
    var protocolFragments = protocol.split('/');
    if (protocolFragments.length === 2) {
        this.protocolName = protocolFragments[0];
        this.protocolVersion = protocolFragments[1];
    } else {
        throw new Error('Could not parse protocol: ' + protocol);
    }
};

HttpResponse.prototype.populateStatusLineFromString = function (statusLine) {
    var matchStatusLine = statusLine.match(/^(\S+) (\d+) (.+)$/);
    if (matchStatusLine) {
        this.populateProtocolFromString(matchStatusLine[1]);
        this.statusCode = parseInt(matchStatusLine[2], 10);
        this.statusMessage = matchStatusLine[3];
    } else {
        throw new Error('Could not parse status line: ' + statusLine);
    }
};

Object.defineProperty(HttpResponse.prototype, 'protocol', {
    enumerable: true,
    get: function () {
        return String(this.protocolName).toUpperCase() + '/' + this.protocolVersion;
    },
    set: function (protocol) {
        this.populateProtocolFromString(protocol);
    }
});

Object.defineProperty(HttpResponse.prototype, 'statusLine', {
    enumerable: true,
    get: function () {
        return this.protocol + ' ' + this.statusCode + ' ' + this.statusMessage;
    },
    set: function (statusLine) {
        this.populateStatusLineFromString(statusLine);
    }
});

HttpResponse.prototype.populateFromString = function (str) {
    var matchStatusLine = str.match(/^([^\r\n]*)(\r\n?|\n\r?|$)/);

    if (matchStatusLine) {
        this.populateStatusLineFromString(matchStatusLine[1]);
        Message.prototype.populateFromString.call(this, str.substr(matchStatusLine[0].length));
    } else {
        throw new Error('Could not find request line');
    }
};

HttpResponse.prototype.toString = function (maxLineLength) {
    return (
        this.statusLine + '\r\n' +
        Message.prototype.toString.call(this, maxLineLength)
    );
};

HttpResponse.prototype.equals = function (other) {
    return (
        other instanceof HttpResponse &&
        this.protocolName === other.protocolName &&
        this.protocolVersion === other.protocolVersion &&
        this.statusCode === other.statusCode &&
        this.statusMessage === other.statusMessage &&
        Message.prototype.equals.call(this, other)
    );
};

// Exploratory work wrt. https://github.com/sunesimonsen/unexpected/issues/40
// FIXME: Makes no sense that you have to specify every property,
// including the "aggregated ones", when mustBeExhaustive is true
HttpResponse.prototype.satisfies = function (spec, mustBeExhaustive) {
    if (!Message.prototype.satisfies.call(this, spec, mustBeExhaustive)) {
        return false;
    }
    return HttpResponse.propertyNames.every(function (propertyName) {
        return (propertyName in spec) ?
            (isRegExp(spec[propertyName]) ?
                spec[propertyName].test(this[propertyName]) :
                this[propertyName] === spec[propertyName]) :
            !mustBeExhaustive || typeof this[propertyName] === 'undefined';
    }, this);
};

module.exports = HttpResponse;

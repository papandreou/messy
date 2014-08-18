var Message = require('./Message'),
    util = require('util');

function HttpRequest(stringOrObjectOrBuffer) {
    Message.call(this, stringOrObjectOrBuffer);
    if (stringOrObjectOrBuffer && typeof stringOrObjectOrBuffer === 'object' && !Buffer.isBuffer(stringOrObjectOrBuffer)) {
        if (stringOrObjectOrBuffer.requestLine) {
            this.populateRequestLineFromString(stringOrObjectOrBuffer.requestLine);
        }
        if (stringOrObjectOrBuffer.method) {
            this.method = stringOrObjectOrBuffer.method.toUpperCase();
        }
        if (stringOrObjectOrBuffer.url) {
            this.url = stringOrObjectOrBuffer.url;
        }
        if (stringOrObjectOrBuffer.protocol) {
            this.protocol = String(stringOrObjectOrBuffer.protocol).toUpperCase();
        }
    }
}

util.inherits(HttpRequest, Message);

HttpRequest.prototype.populateProtocolFromString = function (protocol) {
    var protocolFragments = protocol.split('/');
    if (protocolFragments.length === 2) {
        this.protocolName = protocolFragments[0];
        this.protocolVersion = protocolFragments[1];
    } else {
        throw new Error('Could not parse protocol: ' + protocol);
    }
};

HttpRequest.prototype.populateRequestLineFromString = function (requestLine) {
    var requestLineFragments = requestLine.split(/\s+/);
    if (requestLineFragments.length === 3) {
        this.method = requestLineFragments[0].toUpperCase();
        this.url = requestLineFragments[1];
        this.populateProtocolFromString(requestLineFragments[2]);
    } else {
        throw new Error('Could not parse request line: ' + requestLine);
    }
};

HttpRequest.prototype.populateUrlFromString = function (url) {
    var matchUrl = url.match(/^([^?]*)(\?.*)?$/);
    this.path = matchUrl[1] || '';
    this.search = matchUrl[2] || '';
};

Object.defineProperty(HttpRequest.prototype, 'requestLine', {
    enumerable: true,
    get: function () {
        return this.method + ' ' + this.url + ' ' + this.protocol;
    },
    set: function (requestLine) {
        this.populateRequestLineFromString(requestLine);
    }
});

Object.defineProperty(HttpRequest.prototype, 'protocol', {
    enumerable: true,
    get: function () {
        return this.protocolName + '/' + this.protocolVersion;
    },
    set: function (protocol) {
        this.populateProtocolFromString(protocol);
    }
});

Object.defineProperty(HttpRequest.prototype, 'url', {
    enumerable: true,
    get: function () {
        return (this.path || '') + (this.search || '');
    },
    set: function (url) {
        this.populateUrlFromString(url);
    }
});

Object.defineProperty(HttpRequest.prototype, 'query', {
    enumerable: true,
    get: function () {
        return (this.search || '').replace(/^\?/, '');
    },
    set: function (query) {
        this.url = this.url.replace(/(?:\?.*)?$/, '?' + query);
    }
});

HttpRequest.prototype.populateFromString = function (str) {
    var matchRequestLine = str.match(/^([^\r\n]*)(\r\n?|\n\r?|$)/);

    if (matchRequestLine) {
        this.populateRequestLineFromString(matchRequestLine[1]);
        Message.prototype.populateFromString.call(this, str.substr(matchRequestLine[0].length));
    } else {
        throw new Error('Could not find request line');
    }
};

HttpRequest.prototype.toString = function (maxLineLength) {
    return (
        this.requestLine + '\r\n' +
        Message.prototype.toString.call(this, maxLineLength)
    );
};

HttpRequest.prototype.equals = function (other) {
    return (
        other instanceof HttpRequest &&
        this.method === other.method &&
        (this.path || '') === (other.path || '') &&
        (this.search || '') === (other.search || '') &&
        this.protocolName === other.protocolName &&
        this.protocolVersion === other.protocolVersion &&
        Message.prototype.equals.call(this, other)
    );
};

module.exports = HttpRequest;

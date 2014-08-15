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

HttpRequest.prototype.populateRequestLineFromString = function (requestLine) {
    var requestLineFragments = requestLine.split(/\s+/);
    if (requestLineFragments.length === 3) {
        this.method = requestLineFragments[0].toUpperCase();
        this.url = requestLineFragments[1];
        this.protocol = requestLineFragments[2];
    } else {
        throw new Error('Could not parse request line: ' + requestLine);
    }
};

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
        this.method + ' ' + this.url + ' ' + this.protocol + '\r\n' +
        Message.prototype.toString.call(this, maxLineLength)
    );
};

HttpRequest.prototype.equals = function (other) {
    return (
        other instanceof HttpRequest &&
        this.method === other.method &&
        this.url === other.url &&
        this.protocol === other.protocol &&
        Message.prototype.equals.call(this, other)
    );
};

module.exports = HttpRequest;

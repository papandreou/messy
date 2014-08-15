var Message = require('./Message'),
    util = require('util');

function HttpResponse(stringOrObjectOrBuffer) {
    Message.call(this, stringOrObjectOrBuffer);
    if (stringOrObjectOrBuffer && typeof stringOrObjectOrBuffer === 'object' && !Buffer.isBuffer(stringOrObjectOrBuffer)) {
        if (stringOrObjectOrBuffer.statusLine) {
            this.populateStatusLineFromString(stringOrObjectOrBuffer.statusLine);
        }
        if (stringOrObjectOrBuffer.protocol) {
            this.protocol = String(stringOrObjectOrBuffer.protocol).toUpperCase();
        }
        if ('statusCode' in stringOrObjectOrBuffer) {
            if (typeof stringOrObjectOrBuffer === 'number') {
                this.statusCode = stringOrObjectOrBuffer.statusCode;
            } else {
                this.statusCode = parseInt(stringOrObjectOrBuffer.statusCode, 10);
            }
        }
        if ('statusMessage' in stringOrObjectOrBuffer) {
            this.statusMessage = String(stringOrObjectOrBuffer.statusMessage);
        }
    }
}

util.inherits(HttpResponse, Message);

HttpResponse.prototype.populateStatusLineFromString = function (statusLine) {
    var statusLineFragments = statusLine.split(/\s+/);
    if (statusLineFragments.length === 3) {
        this.protocol = statusLineFragments[0];
        this.statusCode = parseInt(statusLineFragments[1], 10);
        this.statusMessage = statusLineFragments[2];
    } else {
        throw new Error('Could not parse status line: ' + statusLine);
    }
};

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
        this.protocol + ' ' + this.statusCode + ' ' + this.statusMessage + '\r\n' +
        Message.prototype.toString.call(this, maxLineLength)
    );
};

HttpResponse.prototype.equals = function (other) {
    return (
        other instanceof HttpResponse &&
        this.protocol === other.protocol &&
        this.statusCode === other.statusCode &&
        this.statusMessage === other.statusMessage &&
        Message.prototype.equals.call(this, other)
    );
};

module.exports = HttpResponse;

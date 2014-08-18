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
        return this.protocolName + '/' + this.protocolVersion;
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

module.exports = HttpResponse;

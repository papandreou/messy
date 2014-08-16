/*global unescape*/
var Headers = require('./Headers');

function Message(stringOrObjectOrBuffer) {
    this.headers = new Headers();
    if (Buffer.isBuffer(stringOrObjectOrBuffer)) {
        this.populateFromBuffer(stringOrObjectOrBuffer);
    } else if (typeof stringOrObjectOrBuffer === 'string') {
        this.populateFromString(stringOrObjectOrBuffer);
    } else if (stringOrObjectOrBuffer && typeof stringOrObjectOrBuffer === 'object') {
        if (typeof stringOrObjectOrBuffer.headers !== 'undefined') {
            this.headers.populate(stringOrObjectOrBuffer.headers);
        }
        if (typeof stringOrObjectOrBuffer.body !== 'undefined') {
            this.body = stringOrObjectOrBuffer.body;
        }
    }
}

Message.prototype.populateFromBuffer = function (buffer) {
    // Hack: Interpret non-ASCII in headers as iso-8859-1:
    var str = '';
    for (var i = 0 ; i < buffer.length ; i += 1) {
        var octet = buffer[i];
        if (octet > 127) {
            str += unescape('%' + octet.toString(16));
        } else {
            str += String.fromCharCode(octet);
        }
        if (/\r\r$|\n\n$|\r\n\r\n$|\n\r\n\r$/.test(str)) {
            i += 1;
            if (i < buffer.length) {
                this.body = buffer.slice(i);
            }
            break;
        }
    }
    this.headers.populateFromString(str, true);
};

Message.prototype.populateFromString = function (str) {
    var bodyStartIndex = this.headers.populateFromString(str);
    if (bodyStartIndex < str.length) {
        this.body = str.substr(bodyStartIndex);
    }
};

// FIXME: Doesn't compare bodies yet
Message.prototype.equals = function (other) {
    if (!this.headers.equals(other.headers)) {
        return false;
    }
    return true;
};

Message.prototype.toString = function (maxLineLength) {
    if (typeof maxLineLength === 'undefined') {
        maxLineLength = 72;
    }
    var result = this.headers.toString(maxLineLength) || '\r\n';
    if (typeof this.body !== 'undefined') {
        result += '\r\n' + this.body;
    }
    return result;
};

module.exports = Message;

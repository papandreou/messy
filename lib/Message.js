/*global unescape*/
var Headers = require('./Headers');

function Message(stringOrObjectOrBuffer) {
    this.headers = new Headers();
    if (Buffer.isBuffer(stringOrObjectOrBuffer)) {
        var str = '';
        for (var i = 0 ; i < stringOrObjectOrBuffer.length ; i += 1) {
            var octet = stringOrObjectOrBuffer[i];
            if (octet > 127) {
                str += unescape('%' + octet.toString(16));
            } else {
                str += String.fromCharCode(octet);
            }
        }
        stringOrObjectOrBuffer = str;
    }
    if (typeof stringOrObjectOrBuffer === 'string') {
        this.populateFromString(stringOrObjectOrBuffer);
    } else if (stringOrObjectOrBuffer && typeof stringOrObjectOrBuffer === 'object') {
        this.headers.setAll(stringOrObjectOrBuffer);
    }
}

Message.prototype.populateFromString = function (str) {
    var that = this,
        state = 'startLine',
        currentHeaderName = '',
        currentValue = '';

    function flush() {
        if (currentHeaderName.length > 0) {
            that.headers.set(currentHeaderName, currentValue);
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
                    if (str.length >= i + 2) {
                        that.body = str.substr(i + 2);
                    }
                } else {
                    if (str.length >= i + 1) {
                        that.body = str.substr(i + 1);
                    }
                }
                flush();
                return;
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

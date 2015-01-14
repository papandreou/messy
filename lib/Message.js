/*global unescape*/
var Headers = require('./Headers'),
    isRegExp = require('./isRegExp'),
    rfc2231 = require('rfc2231');

function quoteRegExp(str) {
    return str.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function Message(obj) {
    this.headers = new this.HeadersConstructor();
    this.populate(obj);
}

Message.prototype.isMessyMessage = true;

Message.prototype.HeadersConstructor = Headers;

Message.prototype.populate = function (obj) {
    if (typeof Buffer === 'function' && Buffer.isBuffer(obj)) {
        this.populateFromBuffer(obj);
    } else if (typeof obj === 'string') {
        this.populateFromString(obj);
    } else if (obj && typeof obj === 'object') {
        this.populateFromObject(obj);
    }
    return this;
};

Message.prototype.populateFromObject = function (obj) {
    if (typeof obj.headers !== 'undefined') {
        this.headers.populate(obj.headers);
    }
    if (typeof obj.body !== 'undefined') {
        this.body = obj.body;
    }
    return this;
};

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
    return this;
};

Message.prototype.populateFromString = function (str) {
    var bodyStartIndex = this.headers.populateFromStringAndReturnBodyStartIndex(str);
    if (bodyStartIndex < str.length) {
        this.body = str.substr(bodyStartIndex);
    }
    return this;
};

Message.prototype.populateMultipartBody = function () {
    if (this.isMultipart && typeof this.body !== 'undefined') {
        var boundary = this.boundary;
        if (boundary) {
            var bodyAsString;
            if (typeof Buffer === 'function' && Buffer.isBuffer(this.body)) {
                bodyAsString = this.body.toString('ascii');
            } else {
                bodyAsString = this.body;
            }
            var boundaryRegExp = new RegExp('(^|\r\n?|\n\r?)--' + quoteRegExp(boundary) + '(--)?(?:\r\n?|\n\r?|$)', 'g'),
                startIndex = -1,
                parts = [],
                match;
            // TODO: Basic validation of end marker etc.
            while ((match = boundaryRegExp.exec(bodyAsString))) {
                var index = match.index;
                if (startIndex !== -1) {
                    parts.push(new Message(this.body.slice(startIndex, index)));
                }
                startIndex = index + match[0].length;
            }
            if (parts.length > 0) {
                this.body = parts;
            }
        }
    }
};

Object.defineProperty(Message.prototype, 'isMultipart', {
    enumerable: true,
    get: function () {
        return /^multipart\//.test(this.headers.get('Content-Type'));
    }
});

Object.defineProperty(Message.prototype, 'boundary', {
    enumerable: true,
    get: function () {
        if (this.isMultipart) {
            var matchBoundary = this.headers.get('Content-Type').match(/\;\s*boundary=('|"|)(\S*?)\1(?:$|;)/);
            if (matchBoundary) {
                return matchBoundary[2];
            }
        }
    }
});

Object.defineProperty(Message.prototype, 'fileName', {
    get: function () {
        return this.headers.parameter('Content-Disposition', 'filename');
        // TODO: Try falling back to the name attribute of the Content-Type header
    },
    set: function (fileName) {
        if (!this.headers.has('Content-Disposition')) {
            this.headers.set('Content-Disposition', 'attachment');
        }
        this.headers.parameter('Content-Disposition', 'filename', fileName);
        // TODO: Update the name attribute of the Content-Type header
    }
});

function buffersEqual(a, b) {
    if (a === b) {
        return true;
    }

    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }

    return true;
}

function isNonBufferNonRegExpObject(obj) {
    return obj && typeof obj === 'object' && (typeof Buffer === 'undefined' || !Buffer.isBuffer(obj)) && !isRegExp(obj);
}

Message.prototype.clone = function () {
    return new Message({
        headers: this.headers.clone(),
        body: this.body // Not sure
    });
};

Message.prototype.toString = function (maxLineLength) {
    if (typeof maxLineLength === 'undefined') {
        maxLineLength = 72;
    }
    var result = this.headers.toString(maxLineLength);
    if (typeof this.body !== 'undefined') {
        result += '\r\n';
        if (this.body && typeof this.body === 'object' && isNonBufferNonRegExpObject(this.body) && /^application\/json\b|\+json/i.test(this.headers.get('Content-Type'))) {
            result += JSON.stringify(this.body);
        } else if (this.isMultipart && Array.isArray(this.body) && this.boundary) {
            result += '--' + this.boundary + '\r\n' + this.body.join('\r\n--' + this.boundary + '\r\n') + '\r\n--' + this.boundary + '--\r\n';
        } else {
            result += this.body;
        }
    }
    return result;
};

Message.prototype.equals = function (other) {
    return this === other || (
        this.headers.equals(other.headers) &&
        (this.body === other.body ||
        (typeof Buffer === 'function' && Buffer.isBuffer(this.body) && Buffer.isBuffer(other.body) && buffersEqual(this.body, other.body)))
    );
};

Message.prototype.hasEmptyBody = function () {
    if (typeof this.body === 'string') {
        return this.body.length === 0;
    } else if (typeof Buffer === 'function' && Buffer.isBuffer(this.body)) {
        return this.body.length === 0;
    } else if (this.body && typeof this.body === 'object') {
        return false;
    } else {
        return true;
    }
};

module.exports = Message;

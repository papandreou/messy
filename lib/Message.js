/*global unescape*/
var Headers = require('./Headers'),
    isRegExp = require('./isRegExp'),
    iconvLite = require('iconv-lite'),
    quotedPrintable = require('quoted-printable'),
    decodeChunkedTransferEncoding = require('./decodeChunkedTransferEncoding');

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
    this.rawSrc = buffer;
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
    this.rawSrc = str;
    var bodyStartIndex = this.headers.populateFromStringAndReturnBodyStartIndex(str);
    if (bodyStartIndex < str.length) {
        this.body = str.substr(bodyStartIndex);
    }
    return this;
};

Object.defineProperty(Message.prototype, 'hasTextualContentType', {
    get: function () {
        var contentType = this.headers.get('Content-Type');
        if (typeof contentType === 'string') {
            contentType = contentType.toLowerCase().trim().replace(/\s*;.*$/, '');
            return (
                /^text\//.test(contentType) ||
                /^application\/(json|javascript)$/.test(contentType) ||
                /^application\/xml/.test(contentType) ||
                /^application\/x-www-form-urlencoded\b/.test(contentType) ||
                /\+xml$/.test(contentType)
            );
        }
        return false;
    }
});

Object.defineProperty(Message.prototype, 'isMultipart', {
    enumerable: true,
    get: function () {
        return /^multipart\//.test(this.headers.get('Content-Type'));
    }
});

Object.defineProperty(Message.prototype, 'boundary', {
    enumerable: true,
    get: function () {
        return this.isMultipart && this.headers.parameter('Content-Type', 'boundary');
    }
});

Object.defineProperty(Message.prototype, '_bodyMustBeBuffer', {
    get: function () {
        if (this._parts) {
            return this._parts.some(function (part) {
                return part._bodyMustBeBuffer;
            });
        } else {
            return typeof Buffer === 'function' && Buffer.isBuffer(this.body);
        }
    }
});

Object.defineProperty(Message.prototype, 'body', {
    enumerable: true,
    get: function () {
        if (this._parts) {
            if (this._parts.length === 0) {
                return;
            } else {
                if (this._bodyMustBeBuffer) {
                    var chunks = [];

                    this._parts.forEach(function (part, i) {
                        if (i > 0) {
                            chunks.push(new Buffer('\r\n'));
                        }
                        chunks.push(new Buffer('--' + this.boundary + '\r\n'));
                        var serializedPart = part.serialize();
                        if (!Buffer.isBuffer(serializedPart)) {
                            serializedPart = new Buffer(serializedPart);
                        }
                        chunks.push(serializedPart);
                    }, this);

                    chunks.push(new Buffer('\r\n--' + this.boundary + '--\r\n'));
                    return Buffer.concat(chunks);
                } else {
                    return '--' + this.boundary + '\r\n' + this._parts.join('\r\n--' + this.boundary + '\r\n') + '\r\n--' + this.boundary + '--\r\n';
                }
            }
        } else {
            return this._body;
        }
    },
    set: function (body) {
        this._body = body;
        this._parts = null;
    }
});

Object.defineProperty(Message.prototype, 'decodedBody', {
    enumerable: true,
    get: function () {
        var decodedBody = this.body;
        if (decodedBody) {
            var transferEncoding = this.headers.get('Transfer-Encoding');
            if (transferEncoding && transferEncoding === 'chunked') {
                try {
                    decodedBody = decodeChunkedTransferEncoding(decodedBody);
                } catch (e) {}
            }
            var contentTransferEncoding = this.headers.get('Content-Transfer-Encoding'),
                contentTransferEncodingIsHonored = !contentTransferEncoding;
            if (contentTransferEncoding) {
                contentTransferEncoding = contentTransferEncoding.trim().toLowerCase();
                if (contentTransferEncoding === 'quoted-printable') {
                    if (typeof Buffer === 'function' && Buffer.isBuffer(decodedBody)) {
                        decodedBody = decodedBody.toString('ascii');
                    }
                    var qpDecodedBodyAsByteString = quotedPrintable.decode(decodedBody);
                    decodedBody = new Buffer(qpDecodedBodyAsByteString.length);
                    for (var i = 0 ; i < qpDecodedBodyAsByteString.length ; i += 1) {
                        decodedBody[i] = qpDecodedBodyAsByteString.charCodeAt(i);
                    }
                    contentTransferEncodingIsHonored = true;
                } else if (contentTransferEncoding === 'base64') {
                    if (typeof Buffer === 'function' && Buffer.isBuffer(decodedBody)) {
                        decodedBody = decodedBody.toString('ascii');
                    }
                    decodedBody = new Buffer(decodedBody, 'base64');
                    contentTransferEncodingIsHonored = true;
                } else if (contentTransferEncoding === '8bit' || contentTransferEncoding === '7bit') {
                    contentTransferEncodingIsHonored = true;
                }
            }
            if (this.hasTextualContentType && contentTransferEncodingIsHonored && typeof decodedBody !== 'string') {
                var charset = this.headers.parameter('Content-Type', 'charset') || 'iso-8859-1';
                if (iconvLite.encodingExists(charset)) {
                    decodedBody = iconvLite.decode(decodedBody, charset);
                }
            }
        }
        return decodedBody;
    }
});

Object.defineProperty(Message.prototype, 'parts', {
    enumerable: true,
    set: function (parts) {
        this._parts = parts;
    },
    get: function () {
        if (!this._parts && this.isMultipart) {
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
                    this._parts = parts;
                }
            }
        }
        return this._parts;
    }
});

Object.defineProperty(Message.prototype, 'fileName', {
    get: function () {
        return this.headers.parameter('Content-Disposition', 'filename') || (this.isMessyMail && this.headers.parameter('Content-Type', 'name'));
    },
    set: function (fileName) {
        if (!this.headers.has('Content-Disposition')) {
            this.headers.set('Content-Disposition', 'attachment');
        }
        this.headers.parameter('Content-Disposition', 'filename', fileName);
        if (this.isMessyMail && this.headers.has('Content-Type')) {
            this.headers.parameter('Content-Type', 'name', fileName);
        }
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

Message.prototype.serialize = function (maxLineLength, forceString) {
    if (typeof maxLineLength === 'undefined') {
        maxLineLength = 72;
    }
    var result = this.headers.toString(maxLineLength);
    if (typeof this.body !== 'undefined') {
        result += '\r\n';
        if (this.body && typeof this.body === 'object' && isNonBufferNonRegExpObject(this.body) && /^application\/json\b|\+json/i.test(this.headers.get('Content-Type'))) {
            result += JSON.stringify(this.body);
        } else {
            if (!forceString && this._bodyMustBeBuffer) {
                result = Buffer.concat([new Buffer(result), this.body]);
            } else {
                result += this.body;
            }
        }
    }
    return result;
};

Message.prototype.toString = function (maxLineLength) {
    return this.serialize(maxLineLength, true);
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

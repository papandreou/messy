/*global unescape*/
var Headers = require('./Headers'),
    isRegExp = require('./isRegExp');

function Message(obj) {
    this.headers = new Headers();
    this.populate(obj);
}

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

function canonicalizeObject(obj, stack) {
    stack = stack || [];

    if (stack.indexOf(obj) !== -1) return '[Circular]';

    var canonicalizedObject;

    if ({}.toString.call(obj) === '[object Array]') {
        stack.push(obj);
        canonicalizedObject = obj.map(function (item) {
            return canonicalizeObject(item, stack);
        });
        stack.pop();
    } else if (typeof obj === 'object' && obj !== null) {
        stack.push(obj);
        canonicalizedObject = {};
        Object.keys(obj).sort().forEach(function (key) {
            canonicalizedObject[key] = canonicalizeObject(obj[key], stack);
        });
        stack.pop();
    } else {
        canonicalizedObject = obj;
    }

    return canonicalizedObject;
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

function isTextualContentType(contentType) {
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

function bufferCanBeInterpretedAsUtf8(buffer) {
    // Hack: Since Buffer.prototype.toString('utf-8') is very forgiving, convert the buffer to a string
    // with percent-encoded octets, then see if decodeURIComponent accepts it.
    try {
        decodeURIComponent(Array.prototype.map.call(buffer, function (octet) {
            return '%' + (octet < 16 ? '0' : '') + octet.toString(16);
        }).join(''));
    } catch (e) {
        return false;
    }
    return true;
}

Message.prototype.upgradeBody = function () {
    if (typeof this.body !== 'undefined') {
        var isJson = /^application\/json\b/i.test(this.headers.get('Content-Type'));
        if ((typeof Buffer === 'function' && Buffer.isBuffer(this.body)) && isTextualContentType(this.headers.get('Content-Type')) && bufferCanBeInterpretedAsUtf8(this.body)) {
            this.body = this.body.toString('utf-8');
        }
        if (isJson && typeof this.body === 'string') {
            try {
                this.body = JSON.parse(this.body);
            } catch (e) {
                // The body cannot be parsed as JSON, keep as a string instance
            }
        }
    }
};

Message.prototype.upgradeOrDowngradeBodyToMatchSpec = function (spec) {
    if (typeof this.body !== 'undefined') {
        var isJson = /^application\/json\b/i.test(this.headers.get('Content-Type'));
        if (isNonBufferNonRegExpObject(this.body) && isJson) {
            if (typeof spec.body === 'string' || (typeof Buffer === 'function' && Buffer.isBuffer(spec.body))) {
                var parsedSpecBody;
                try {
                    parsedSpecBody = JSON.parse(spec.body);
                } catch (e) {}
                if (typeof parsedSpecBody !== 'undefined') {
                    spec.body = JSON.stringify(canonicalizeObject(parsedSpecBody), undefined, '  ');
                    this.body = JSON.stringify(this.body, undefined, '  ');
                }
            } else if (isRegExp(spec.body)) {
                this.body = JSON.stringify(this.body, undefined, '  ');
            }
        }
        if (typeof Buffer === 'function' && Buffer.isBuffer(this.body) && ((typeof spec.body === 'string' || isRegExp(spec.body) || isNonBufferNonRegExpObject(spec.body)) || (bufferCanBeInterpretedAsUtf8(this.body) && isTextualContentType(this.headers.get('Content-Type'))))) {
            try {
                this.body = this.body.toString('utf-8');
            } catch (e) {
                // The body cannot be intepreted as utf-8, keep it as a Buffer instance
            }
        }
        if (isJson && typeof this.body === 'string' && (typeof spec.body === 'undefined' || isNonBufferNonRegExpObject(spec.body))) {
            try {
                this.body = JSON.parse(this.body);
            } catch (e) {
                // The body cannot be parsed as JSON, keep as a string instance
            }
        } else if (typeof Buffer === 'function' && Buffer.isBuffer(spec.body) && (!this.body || typeof this.body === 'string')) {
            this.body = new Buffer(this.body, 'utf-8');
        }
    } else if (typeof Buffer === 'function' && Buffer.isBuffer(spec.body) && spec.body.length === 0) {
        this.body = new Buffer([]);
    } else if (spec.body === '') {
        this.body = '';
    }
};

module.exports = Message;

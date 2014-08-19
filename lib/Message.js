/*global unescape*/
var Headers = require('./Headers'),
    isRegExp = require('./isRegExp');

function Message(obj) {
    this.headers = new Headers();
    this.populate(obj);
}

Message.prototype.populate = function (obj) {
    if (Buffer.isBuffer(obj)) {
        this.populateFromBuffer(obj);
    } else if (typeof obj === 'string') {
        this.populateFromString(obj);
    } else if (obj && typeof obj === 'object') {
        this.populateFromObject(obj);
    }
};

Message.prototype.populateFromObject = function (obj) {
    if (typeof obj.headers !== 'undefined') {
        this.headers.populate(obj.headers);
    }
    if (typeof obj.body !== 'undefined') {
        this.body = obj.body;
    }
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
};

Message.prototype.populateFromString = function (str) {
    var bodyStartIndex = this.headers.populateFromString(str);
    if (bodyStartIndex < str.length) {
        this.body = str.substr(bodyStartIndex);
    }
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
    return obj && typeof obj === 'object' && !Buffer.isBuffer(obj) && !isRegExp(obj);
}

function canonicalizeObject(obj, stack) {
    stack = stack || [];

    if (stack.indexOf(obj) !== -1) return '[Circular]';

    var canonicalizedObject;

    if ({}.toString.call(obj) === '[object Array]') {
        stack.push(obj);
        canonicalizedObject = exports.map(obj, function (item) {
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

Message.prototype.equals = function (other) {
    if (!this.headers.equals(other.headers)) {
        return false;
    }
    return (
        this.body === other.body ||
        (Buffer.isBuffer(this.body) && Buffer.isBuffer(other.body) && buffersEqual(this.body, other.body))
    );
};

function isTextualContentType(contentType) {
    if (typeof contentType === 'string') {
        contentType = contentType.toLowerCase().trim().replace(/\s*;.*$/, '');
        return (
            /^text\//.test(contentType) ||
            /^application\/(json|javascript)$/.test(contentType) ||
            /^application\/xml/.test(contentType) ||
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

// Exploratory work wrt. https://github.com/sunesimonsen/unexpected/issues/40
Message.prototype.satisfies = function (spec, mustBeExhaustive) {
    if (typeof spec === 'string') {
        spec = new Message(spec);
    }
    if ('headers' in spec) {
        if (!this.headers.satisfy(spec.headers, mustBeExhaustive)) {
            return false;
        }
    } else if (mustBeExhaustive && this.headers.getNames().length > 0) {
        return false;
    }

    var thisBody = this.body;
    if ('body' in spec) {
        var specBody = spec.body;

        if (typeof thisBody !== 'undefined') {

            if (isNonBufferNonRegExpObject(thisBody) && /^application\/json\b/i.test(this.headers.get('Content-Type'))) {
                if (typeof specBody === 'string' || Buffer.isBuffer(specBody)) {
                    var parsedSpecBody;
                    try {
                        parsedSpecBody = JSON.parse(specBody);
                    } catch (e) {}
                    if (typeof parsedSpecBody !== 'undefined') {
                        specBody = JSON.stringify(canonicalizeObject(parsedSpecBody), undefined, '  ');
                        thisBody = JSON.stringify(thisBody, undefined, '  ');
                    }
                } else if (isRegExp(specBody)) {
                    thisBody = JSON.stringify(thisBody, undefined, '  ');
                }
            }
            if (Buffer.isBuffer(thisBody) && (typeof specBody === 'string' || isRegExp(specBody) || isNonBufferNonRegExpObject(specBody)) || (typeof specBody === 'undefined' && bufferCanBeInterpretedAsUtf8(thisBody) && isTextualContentType(this.headers.get('Content-Type')))) {
                try {
                    thisBody = thisBody.toString('utf-8');
                } catch (e) {
                    // The body cannot be intepreted as utf-8, keep it as a Buffer instance
                }
            }
            if (/^application\/json\b/i.test(this.headers.get('Content-Type')) && typeof thisBody === 'string' && (typeof specBody === 'undefined' || isNonBufferNonRegExpObject(specBody))) {
                try {
                    thisBody = JSON.parse(thisBody);
                } catch (e) {
                    // The body cannot be parsed as JSON, kepe as a string instance
                }
            } else if (Buffer.isBuffer(specBody) && (!thisBody || typeof thisBody === 'string')) {
                thisBody = new Buffer(thisBody, 'utf-8');
            }
        } else if (Buffer.isBuffer(specBody) && specBody.length === 0) {
            thisBody = new Buffer([]);
        } else if (specBody === '') {
            thisBody = '';
        }

        if (Buffer.isBuffer(specBody) && Buffer.isBuffer(thisBody)) {
            if (!buffersEqual(specBody, thisBody)) {
                return false;
            }
        } else if (isRegExp(specBody) && typeof thisBody === 'string') {
            if (!specBody.test(thisBody)) {
                return false;
            }
        } else if (typeof specBody === 'string' && typeof thisBody === 'string') {
            if (specBody !== thisBody) {
                return false;
            }
        } else if (typeof specBody === 'undefined') {
            if (typeof thisBody !== 'undefined') {
                return false;
            }
        } else if (isNonBufferNonRegExpObject(specBody) && isNonBufferNonRegExpObject(thisBody)) {
            if (JSON.stringify(canonicalizeObject(specBody)) !== JSON.stringify(canonicalizeObject(thisBody))) {
                return false;
            }
        } else {
            return false;
        }
    } else if (mustBeExhaustive && typeof thisBody !== 'undefined') {
        return false;
    }
    return true;
};

module.exports = Message;

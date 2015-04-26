var Message = require('./Message'),
    RequestLine = require('./RequestLine'),
    util = require('util');

function HttpRequest(obj) {
    this.requestLine = new RequestLine();
    this.encrypted = false;
    Message.call(this, obj);
}

HttpRequest.metadataPropertyNames = ['encrypted', 'cert', 'key', 'ca'];

HttpRequest.propertyNames = Message.propertyNames.concat(HttpRequest.metadataPropertyNames).concat(RequestLine.propertyNames).concat(['requestLine']);

util.inherits(HttpRequest, Message);

HttpRequest.prototype.isMessyHttpRequest = true;

HttpRequest.prototype.populate = function (obj) {
    if (obj && typeof obj === 'object' && (typeof Buffer === 'undefined' || !Buffer.isBuffer(obj))) {
        this.populateFromObject(obj);
    } else {
        Message.prototype.populate.call(this, obj);
    }
    return this;
};

HttpRequest.prototype.populateFromObject = function (obj) {
    Message.prototype.populateFromObject.call(this, obj);
    if (typeof obj.requestLine !== 'undefined') {
        this.requestLine.populate(obj.requestLine);
    }
    HttpRequest.metadataPropertyNames.forEach(function (metadataPropertyName) {
        if (typeof obj[metadataPropertyName] !== 'undefined') {
            this[metadataPropertyName] = obj[metadataPropertyName];
        }
    }, this);
    this.requestLine.populateFromObject(obj);
    return this;
};

HttpRequest.prototype.populateFromString = function (str) {
    var matchRequestLine = str.match(/^([^\r\n]*)(\r\n?|\n\r?|$)/);

    if (matchRequestLine) {
        this.requestLine.populateFromString(matchRequestLine[1]);
        Message.prototype.populateFromString.call(this, str.substr(matchRequestLine[0].length));
    }
    return this;
};

HttpRequest.prototype.populateFromBuffer = function (buffer) {
    var i = 0;
    while (i < buffer.length && buffer[i] !== 0x0d && buffer[i] !== 0x0a) {
        i += 1;
    }
    if (i > 0) {
        this.requestLine.populateFromString(buffer.slice(0, i).toString('ascii'));
    }
    if (buffer[i] === 0x0d) {
        i += 1;
    }
    if (buffer[i] === 0x0a) {
        i += 1;
    }
    Message.prototype.populateFromBuffer.call(this, buffer.slice(i));
    return this;
};

HttpRequest.prototype.clone = function () {
    return new HttpRequest({
        requestLine: this.requestLine.clone(),
        headers: this.headers.clone(),
        body: this.body // Not sure
    });
};

HttpRequest.prototype.toString = function (maxLineLength) {
    return (
        this.requestLine.toString() + '\r\n' +
        Message.prototype.toString.call(this, maxLineLength)
    );
};

HttpRequest.prototype.equals = function (other) {
    return this === other || (
        other instanceof HttpRequest &&
        this.requestLine.equals(other.requestLine) &&
        Boolean(this.encrypted) === Boolean(other.encrypted) &&
        Message.prototype.equals.call(this, other)
    );
};

RequestLine.propertyNames.forEach(function (requestLinePropertyName) {
    Object.defineProperty(HttpRequest.prototype, requestLinePropertyName, {
        enumerable: true,
        get: function () {
            return this.requestLine[requestLinePropertyName];
        },
        set: function (value) {
            this.requestLine[requestLinePropertyName] = value;
        }
    });
});

module.exports = HttpRequest;

function RequestLine(obj) {
    this.populate(obj);
}

RequestLine.propertyNames = ['method', 'url', 'path', 'search', 'query', 'protocol', 'protocolName', 'protocolVersion'];

RequestLine.prototype.populate = function (obj) {
    if (obj && typeof obj === 'object' && !Buffer.isBuffer(obj)) {
        this.populateFromObject(obj);
    } else if (typeof obj === 'string') {
        this.populateFromString(obj);
    }
    return this;
};

RequestLine.prototype.populateFromObject = function (obj) {
    RequestLine.propertyNames.forEach(function (propertyName) {
        if (typeof obj[propertyName] !== 'undefined') {
            this[propertyName] = obj[propertyName];
        }
    }, this);
    return this;
};

RequestLine.prototype.populateProtocolFromString = function (protocol) {
    var protocolFragments = protocol.split('/');
    if (protocolFragments.length === 2) {
        this.protocolName = protocolFragments[0];
        this.protocolVersion = protocolFragments[1];
    } else {
        throw new Error('Could not parse protocol: ' + protocol);
    }
    return this;
};

RequestLine.prototype.populateFromString = function (str) {
    var requestLineFragments = str.split(/\s+/);
    if (requestLineFragments.length === 3) {
        this.method = requestLineFragments[0].toUpperCase();
        this.url = requestLineFragments[1];
        this.populateProtocolFromString(requestLineFragments[2]);
    } else {
        throw new Error('Could not parse request line: ' + str);
    }
    return this;
};

RequestLine.prototype.populateUrlFromString = function (url) {
    var matchUrl = url.match(/^([^?]*)(\?.*)?$/);
    this.path = matchUrl[1] || '';
    this.search = matchUrl[2] || undefined;
    return this;
};

Object.defineProperty(RequestLine.prototype, 'protocol', {
    enumerable: true,
    get: function () {
        return String(this.protocolName).toUpperCase() + '/' + this.protocolVersion;
    },
    set: function (protocol) {
        this.populateProtocolFromString(protocol);
    }
});

Object.defineProperty(RequestLine.prototype, 'url', {
    enumerable: true,
    get: function () {
        return (this.path || '') + (this.search || '');
    },
    set: function (url) {
        this.populateUrlFromString(url);
    }
});

Object.defineProperty(RequestLine.prototype, 'query', {
    enumerable: true,
    get: function () {
        return typeof this.search === 'undefined' ? undefined : String(this.search).replace(/^\?/, '');
    },
    set: function (query) {
        this.url = this.url.replace(/(?:\?.*)?$/, typeof query === 'undefined' ? '' : '?' + String(query));
    }
});

RequestLine.prototype.clone = function () {
    return new RequestLine(this);
};

RequestLine.prototype.toString = function (maxLineLength) {
    return String(this.method).toUpperCase() + ' ' + this.url + ' ' + this.protocol;
};

RequestLine.prototype.equals = function (other) {
    return (
        other instanceof RequestLine &&
        this.method === other.method &&
        (this.path || '') === (other.path || '') &&
        (this.search || '') === (other.search || '') &&
        this.protocolName === other.protocolName &&
        this.protocolVersion === other.protocolVersion
    );
};

module.exports = RequestLine;

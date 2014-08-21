var Message = require('./Message'),
    RequestLine = require('./RequestLine'),
    util = require('util'),
    _ = require('underscore'),
    isRegExp = require('./isRegExp');

function HttpRequest(obj) {
    this.requestLine = new RequestLine();
    Message.call(this, obj);
}

util.inherits(HttpRequest, Message);

HttpRequest.prototype.populate = function (obj) {
    Message.prototype.populate.call(this, obj);
    if (obj && typeof obj === 'object' && !Buffer.isBuffer(obj)) {
        this.populateFromObject(obj);
    }
};

HttpRequest.prototype.populateFromObject = function (obj) {
    Message.prototype.populateFromObject.call(this, obj);
    if (typeof obj.requestLine === 'string') {
        this.requestLine.populateFromString(obj.requestLine);
    }
    this.requestLine.populateFromObject(obj);
};

HttpRequest.prototype.populateFromString = function (str) {
    var matchRequestLine = str.match(/^([^\r\n]*)(\r\n?|\n\r?|$)/);

    if (matchRequestLine) {
        this.requestLine.populateFromString(matchRequestLine[1]);
        Message.prototype.populateFromString.call(this, str.substr(matchRequestLine[0].length));
    } else {
        throw new Error('Could not find request line');
    }
};

HttpRequest.prototype.toString = function (maxLineLength) {
    return (
        this.requestLine.toString() + '\r\n' +
        Message.prototype.toString.call(this, maxLineLength)
    );
};

HttpRequest.prototype.equals = function (other) {
    return (
        other instanceof HttpRequest &&
        this.requestLine.equals(other.requestLine) &&
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

// Exploratory work wrt. https://github.com/sunesimonsen/unexpected/issues/40
// FIXME: Makes no sense that you have to specify every property,
// including the "aggregated ones", when mustBeExhaustive is true
HttpRequest.prototype.satisfies = function (spec, mustBeExhaustive) {
    if (!Message.prototype.satisfies.call(this, spec, mustBeExhaustive)) {
        return false;
    }
    if ('requestLine' in spec) {
        if (spec.requestLine && typeof spec.requestLine === 'object') {
            if (!this.requestLine.satisfies(spec.requestLine, mustBeExhaustive)) {
                return false;
            }
        } else if (isRegExp(spec.requestLine)) {
            if (!spec.requestLine.test(this.requestLine.toString())) {
                return false;
            }
        } else if (this.requestLine.toString() !== spec.requestLine) {
            return false;
        }
    }
    // Make the RequestLine properties available for matching:
    if (!this.requestLine.satisfies(_.pick(spec, RequestLine.propertyNames), mustBeExhaustive)) {
        return false;
    }
    return true;
};

module.exports = HttpRequest;

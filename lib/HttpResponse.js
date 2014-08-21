var Message = require('./Message'),
    StatusLine = require('./StatusLine'),
    util = require('util'),
    _ = require('underscore'),
    isRegExp = require('./isRegExp');

function HttpResponse(obj) {
    this.statusLine = new StatusLine();
    Message.call(this, obj);
}

util.inherits(HttpResponse, Message);

HttpResponse.prototype.populate = function (obj) {
    Message.prototype.populate.call(this, obj);
    if (obj && typeof obj === 'object' && !Buffer.isBuffer(obj)) {
        this.populateFromObject(obj);
    }
};

HttpResponse.prototype.populateFromObject = function (obj) {
    Message.prototype.populateFromObject.call(this, obj);
    if (typeof obj.statusLine !== 'undefined') {
        this.statusLine.populate(obj.statusLine);
    }
    this.statusLine.populateFromObject(obj);
};

HttpResponse.prototype.populateFromString = function (str) {
    var matchStatusLine = str.match(/^([^\r\n]*)(\r\n?|\n\r?|$)/);

    if (matchStatusLine) {
        this.statusLine.populateFromString(matchStatusLine[1]);
        Message.prototype.populateFromString.call(this, str.substr(matchStatusLine[0].length));
    } else {
        throw new Error('Could not find status line');
    }
};

HttpResponse.prototype.toString = function (maxLineLength) {
    return (
        this.statusLine.toString() + '\r\n' +
        Message.prototype.toString.call(this, maxLineLength)
    );
};

HttpResponse.prototype.equals = function (other) {
    return (
        other instanceof HttpResponse &&
        this.statusLine.equals(other.statusLine) &&
        Message.prototype.equals.call(this, other)
    );
};

StatusLine.propertyNames.forEach(function (statusLinePropertyName) {
    Object.defineProperty(HttpResponse.prototype, statusLinePropertyName, {
        enumerable: true,
        get: function () {
            return this.statusLine[statusLinePropertyName];
        },
        set: function (value) {
            this.statusLine[statusLinePropertyName] = value;
        }
    });
});

// Exploratory work wrt. https://github.com/sunesimonsen/unexpected/issues/40
// FIXME: Makes no sense that you have to specify every property,
// including the "aggregated ones", when mustBeExhaustive is true
HttpResponse.prototype.satisfies = function (spec, mustBeExhaustive) {
    if (!Message.prototype.satisfies.call(this, spec, mustBeExhaustive)) {
        return false;
    }
    if ('statusLine' in spec) {
        if (spec.statusLine && typeof spec.statusLine === 'object') {
            if (!this.statusLine.satisfies(spec.statusLine, mustBeExhaustive)) {
                return false;
            }
        } else if (isRegExp(spec.statusLine)) {
            if (!spec.statusLine.test(this.statusLine.toString())) {
                return false;
            }
        } else if (this.statusLine.toString() !== spec.statusLine) {
            return false;
        }
    }
    // Make the StatusLine properties available for matching:
    if (!this.statusLine.satisfies(_.pick(spec, StatusLine.propertyNames), mustBeExhaustive)) {
        return false;
    }
    return true;
};

module.exports = HttpResponse;

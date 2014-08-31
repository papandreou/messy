var Message = require('./Message'),
    StatusLine = require('./StatusLine'),
    util = require('util');

function HttpResponse(obj) {
    this.statusLine = new StatusLine();
    Message.call(this, obj);
}

util.inherits(HttpResponse, Message);

HttpResponse.prototype.populate = function (obj) {
    Message.prototype.populate.call(this, obj);
    if (obj && typeof obj === 'object' && (typeof Buffer === 'undefined' || !Buffer.isBuffer(obj))) {
        this.populateFromObject(obj);
    }
    return this;
};

HttpResponse.prototype.populateFromObject = function (obj) {
    Message.prototype.populateFromObject.call(this, obj);
    if (typeof obj.statusLine !== 'undefined') {
        this.statusLine.populate(obj.statusLine);
    }
    this.statusLine.populateFromObject(obj);
    return this;
};

HttpResponse.prototype.populateFromString = function (str) {
    var matchStatusLine = str.match(/^([^\r\n]*)(\r\n?|\n\r?|$)/);

    if (matchStatusLine) {
        this.statusLine.populateFromString(matchStatusLine[1]);
        Message.prototype.populateFromString.call(this, str.substr(matchStatusLine[0].length));
    } else {
        throw new Error('Could not find status line');
    }
    return this;
};

HttpResponse.prototype.clone = function () {
    return new HttpResponse({
        statusLine: this.statusLine.clone(),
        headers: this.headers.clone(),
        body: this.body // Not sure
    });
};

HttpResponse.prototype.toString = function (maxLineLength) {
    return (
        this.statusLine.toString() + '\r\n' +
        Message.prototype.toString.call(this, maxLineLength)
    );
};

HttpResponse.prototype.equals = function (other) {
    return this === other || (
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

module.exports = HttpResponse;

function StatusLine(obj) {
    this.populate(obj);
}

StatusLine.propertyNames = ['protocol', 'protocolName', 'protocolVersion', 'statusCode', 'statusMessage'];

StatusLine.prototype.populate = function (obj) {
    if (typeof obj === 'string') {
        this.populateFromString(obj);
    } else if (obj && typeof obj === 'object' && !Buffer.isBuffer(obj)) {
        this.populateFromObject(obj);
    }
};

StatusLine.prototype.populateFromObject = function (obj) {
    StatusLine.propertyNames.forEach(function (propertyName) {
        if (typeof obj[propertyName] !== 'undefined') {
            this[propertyName] = obj[propertyName];
        }
    }, this);
};

StatusLine.prototype.populateFromString = function (statusLine) {
    var matchStatusLine = statusLine.match(/^(\S+) (\d+) (.+)$/);
    if (matchStatusLine) {
        this.populateProtocolFromString(matchStatusLine[1]);
        this.statusCode = parseInt(matchStatusLine[2], 10);
        this.statusMessage = matchStatusLine[3];
    } else {
        throw new Error('Could not parse status line: ' + statusLine);
    }
};

StatusLine.prototype.populateProtocolFromString = function (protocol) {
    var protocolFragments = protocol.split('/');
    if (protocolFragments.length === 2) {
        this.protocolName = protocolFragments[0];
        this.protocolVersion = protocolFragments[1];
    } else {
        throw new Error('Could not parse protocol: ' + protocol);
    }
};

Object.defineProperty(StatusLine.prototype, 'protocol', {
    enumerable: true,
    get: function () {
        return String(this.protocolName).toUpperCase() + '/' + this.protocolVersion;
    },
    set: function (protocol) {
        this.populateProtocolFromString(protocol);
    }
});

StatusLine.prototype.toString = function () {
    return this.protocol + ' ' + this.statusCode + ' ' + this.statusMessage;
};

StatusLine.prototype.equals = function (other) {
    return (
        other instanceof StatusLine &&
        this.protocolName === other.protocolName &&
        this.protocolVersion === other.protocolVersion &&
        this.statusCode === other.statusCode &&
        this.statusMessage === other.statusMessage
    );
};

module.exports = StatusLine;

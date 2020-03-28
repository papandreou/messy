const Message = require('./Message');
const StatusLine = require('./StatusLine');
const util = require('util');
const omit = require('lodash.omit');

function HttpResponse(obj, doNotStringify) {
  this.statusLine = new StatusLine();
  Message.call(this, obj, doNotStringify);
}

const ownPropertyNames = ['statusLine'].concat(StatusLine.propertyNames);

HttpResponse.propertyNames = Message.propertyNames.concat(ownPropertyNames);

util.inherits(HttpResponse, Message);

HttpResponse.prototype.isMessyHttpResponse = true;

HttpResponse.prototype.populate = function (obj) {
  if (typeof obj === 'number') {
    this.populateFromObject({ statusCode: obj });
  } else if (
    obj &&
    typeof obj === 'object' &&
    (typeof Buffer === 'undefined' || !Buffer.isBuffer(obj))
  ) {
    this.populateFromObject(obj);
  } else {
    Message.prototype.populate.call(this, obj);
  }
  return this;
};

HttpResponse.prototype.populateFromObject = function (obj) {
  Message.prototype.populateFromObject.call(this, omit(obj, ownPropertyNames));
  if (typeof obj.statusLine !== 'undefined') {
    this.statusLine.populate(obj.statusLine);
  }
  this.statusLine.populateFromObject(obj);
  return this;
};

HttpResponse.prototype.populateFromString = function (str) {
  const matchStatusLine = str.match(/^([^\r\n]*)(\r\n?|\n\r?|$)/);

  if (matchStatusLine) {
    this.statusLine.populateFromString(matchStatusLine[1]);
    Message.prototype.populateFromString.call(
      this,
      str.substr(matchStatusLine[0].length)
    );
  }
  return this;
};

HttpResponse.prototype.populateFromBuffer = function (buffer) {
  let i = 0;
  while (i < buffer.length && buffer[i] !== 0x0d && buffer[i] !== 0x0a) {
    i += 1;
  }
  if (i > 0) {
    this.statusLine.populateFromString(buffer.slice(0, i).toString('ascii'));
  } else {
    return;
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

HttpResponse.prototype.clone = function () {
  return new HttpResponse({
    statusLine: this.statusLine.clone(),
    headers: this.headers.clone(),
    body: this.body, // Not sure
  });
};

HttpResponse.prototype.toString = function (maxLineLength) {
  return `${this.statusLine.toString()}\r\n${Message.prototype.toString.call(
    this,
    maxLineLength
  )}`;
};

HttpResponse.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof HttpResponse &&
      this.statusLine.equals(other.statusLine) &&
      Message.prototype.equals.call(this, other))
  );
};

StatusLine.propertyNames.forEach(function (statusLinePropertyName) {
  Object.defineProperty(HttpResponse.prototype, statusLinePropertyName, {
    enumerable: true,
    get() {
      return this.statusLine[statusLinePropertyName];
    },
    set(value) {
      this.statusLine[statusLinePropertyName] = value;
    },
  });
});

HttpResponse.prototype.toJSON = function () {
  return {
    ...Message.prototype.toJSON.call(this),
    ...this.statusLine.toJSON(),
  };
};

module.exports = HttpResponse;

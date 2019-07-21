/* global unescape, btoa, atob, JSON */
const Headers = require('./Headers');
const isRegExp = require('./isRegExp');
const iconvLite = require('iconv-lite');
const quotedPrintable = require('quoted-printable');
const decodeChunkedTransferEncoding = require('./decodeChunkedTransferEncoding');
let zlib;

try {
  zlib = require('' + 'zlib');
} catch (e) {}

function isDefined(obj) {
  return obj !== null && typeof obj !== 'undefined';
}

function quoteRegExp(str) {
  return str.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function Message(obj, doNotStringify) {
  this.headers = new this.HeadersConstructor();
  this.populate(obj, doNotStringify);
}

// Descending priority:
const bodyPropertyNames = [
  'parts',
  'body',
  'unchunkedBody',
  'decodedBody',
  'rawBody'
];

Message.propertyNames = [
  'headers',
  'fileName',
  'isJson',
  'isMultipart',
  'boundary',
  'charset'
].concat(bodyPropertyNames);

Message.prototype.isMessyMessage = true;

Message.prototype.HeadersConstructor = Headers;

Message.prototype.populate = function(obj) {
  if (typeof Buffer === 'function' && Buffer.isBuffer(obj)) {
    this.populateFromBuffer(obj);
  } else if (typeof obj === 'string') {
    this.populateFromString(obj);
  } else if (obj && typeof obj === 'object') {
    this.populateFromObject(obj);
  }
  return this;
};

const isSupportedByPropertyName = {};
Message.propertyNames.forEach(function(propertyName) {
  isSupportedByPropertyName[propertyName] = true;
});

Message.prototype.populateFromObject = function(obj) {
  const unsupportedPropertyNames = Object.keys(obj).filter(function(
    propertyName
  ) {
    return !isSupportedByPropertyName[propertyName];
  });
  if (unsupportedPropertyNames.length > 0) {
    throw new Error(
      `messy.Message: Unsupported property name${
        unsupportedPropertyNames.length === 1 ? '' : 's'
      }: ${unsupportedPropertyNames.join(', ')}`
    );
  }
  if (typeof obj.headers !== 'undefined') {
    this.headers.populate(obj.headers);
  }
  if (typeof obj.parts !== 'undefined') {
    this.parts = (Array.isArray(obj.parts) ? obj.parts : [obj.parts]).map(
      function(part) {
        return part && part.isMessyMessage ? part : new Message(part);
      }
    );
  } else if (typeof obj.rawBody !== 'undefined') {
    this.rawBody = obj.rawBody;
  } else if (typeof obj.body !== 'undefined') {
    if (
      (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj.body)) ||
      typeof obj.body === 'string'
    ) {
      this.unchunkedBody = obj.body;
    } else {
      this.body = obj.body;
    }
  } else if (typeof obj.decodedBody !== 'undefined') {
    this.decodedBody = obj.decodedBody;
  } else if (typeof obj.unchunkedBody !== 'undefined') {
    this.unchunkedBody = obj.unchunkedBody;
  }
  return this;
};

Message.prototype.populateFromBuffer = function(buffer) {
  // Hack: Interpret non-ASCII in headers as iso-8859-1:
  let str = '';
  for (let i = 0; i < buffer.length; i += 1) {
    const octet = buffer[i];
    if (octet > 127) {
      str += unescape(`%${octet.toString(16)}`);
    } else {
      str += String.fromCharCode(octet);
    }
    if (/\r\r$|\n\n$|\r\n\r\n$|\n\r\n\r$/.test(str)) {
      i += 1;
      if (i < buffer.length) {
        this.rawBody = buffer.slice(i);
      }
      break;
    }
  }
  this.headers.populateFromString(str, true);
  return this;
};

Message.prototype.populateFromString = function(str) {
  const bodyStartIndex = this.headers.populateFromStringAndReturnBodyStartIndex(
    str
  );
  if (bodyStartIndex < str.length) {
    this.rawBody = str.substr(bodyStartIndex);
  }
  return this;
};

Object.defineProperty(Message.prototype, 'hasTextualContentType', {
  get() {
    let contentType = this.headers.get('Content-Type');
    if (typeof contentType === 'string') {
      contentType = contentType
        .toLowerCase()
        .trim()
        .replace(/\s*;.*$/, '');
      return (
        /^text\//.test(contentType) ||
        /^application\/(?:json|javascript)$/.test(contentType) ||
        /^application\/xml/.test(contentType) ||
        /^application\/x-www-form-urlencoded\b/.test(contentType) ||
        /^application\/graphql\b/.test(contentType) ||
        /\+xml$/.test(contentType) ||
        /\+json$/.test(contentType)
      );
    }
    return false;
  }
});

Object.defineProperty(Message.prototype, 'isJson', {
  get() {
    return /^application\/json\b|\+json\b/i.test(
      this.headers.get('Content-Type')
    );
  }
});

Object.defineProperty(Message.prototype, 'charset', {
  get() {
    const charset = this.headers.parameter('Content-Type', 'charset');
    if (charset) {
      return charset;
    }
    const contentType = this.headers.get('Content-Type');
    if (contentType && /^application\/json\b|\+json\b/i.test(contentType)) {
      return 'utf-8';
    }
    return 'iso-8859-1';
  }
});

Object.defineProperty(Message.prototype, 'isMultipart', {
  enumerable: true,
  get() {
    return /^multipart\//.test(this.headers.get('Content-Type'));
  }
});

Object.defineProperty(Message.prototype, 'boundary', {
  enumerable: true,
  get() {
    return (
      this.isMultipart && this.headers.parameter('Content-Type', 'boundary')
    );
  }
});

Object.defineProperty(Message.prototype, '_bodyMustBeBuffer', {
  get() {
    if (this._parts) {
      return this._parts.some(function(part) {
        return part._bodyMustBeBuffer;
      });
    } else {
      return typeof Buffer === 'function' && Buffer.isBuffer(this.body);
    }
  }
});

Object.defineProperty(Message.prototype, 'decodedBody', {
  enumerable: true,
  get() {
    if (!isDefined(this._decodedBody)) {
      if (isDefined(this._rawBody) || isDefined(this._unchunkedBody)) {
        this._decodedBody = this.unchunkedBody;
        if (zlib && zlib.gunzipSync) {
          let contentEncoding = this.headers.get('Content-Encoding');
          if (contentEncoding) {
            contentEncoding = contentEncoding.trim().toLowerCase();
            if (contentEncoding === 'gzip' || contentEncoding === 'deflate') {
              if (
                typeof Buffer !== 'undefined' &&
                !Buffer.isBuffer(this._body)
              ) {
                this._decodedBody = Buffer.from(this._decodedBody, 'utf-8');
              }

              try {
                this._decodedBody = zlib[
                  contentEncoding === 'gzip' ? 'gunzipSync' : 'inflateSync'
                ](this._decodedBody);
              } catch (e) {}
            }
          }
        }
        let contentTransferEncoding = this.headers.get(
          'Content-Transfer-Encoding'
        );
        let contentTransferEncodingIsHonored = !contentTransferEncoding;
        if (contentTransferEncoding) {
          contentTransferEncoding = contentTransferEncoding
            .trim()
            .toLowerCase();
          if (contentTransferEncoding === 'quoted-printable') {
            if (
              typeof Buffer === 'function' &&
              Buffer.isBuffer(this._decodedBody)
            ) {
              this._decodedBody = this._decodedBody.toString('ascii');
            }
            const qpDecodedBodyAsByteString = quotedPrintable.decode(
              this._decodedBody
            );
            this._decodedBody = Buffer.alloc(qpDecodedBodyAsByteString.length);
            for (let i = 0; i < qpDecodedBodyAsByteString.length; i += 1) {
              this._decodedBody[i] = qpDecodedBodyAsByteString.charCodeAt(i);
            }
            contentTransferEncodingIsHonored = true;
          } else if (contentTransferEncoding === 'base64') {
            if (
              typeof Buffer === 'function' &&
              Buffer.isBuffer(this._decodedBody)
            ) {
              this._decodedBody = this._decodedBody.toString('ascii');
            }
            if (typeof Buffer !== 'undefined') {
              this._decodedBody = Buffer.from(this._decodedBody, 'base64');
            } else {
              this._decodedBody = atob(this._decodedBody);
            }
            contentTransferEncodingIsHonored = true;
          } else if (
            contentTransferEncoding === '8bit' ||
            contentTransferEncoding === '7bit'
          ) {
            contentTransferEncodingIsHonored = true;
          }
        }
        if (
          this.hasTextualContentType &&
          contentTransferEncodingIsHonored &&
          this._decodedBody &&
          typeof this._decodedBody !== 'string'
        ) {
          const charset = this.charset;
          if (iconvLite.encodingExists(charset)) {
            this._decodedBody = iconvLite.decode(this._decodedBody, charset);
          }
        }
      } else if (isDefined(this._body) || isDefined(this._parts)) {
        this._decodedBody = this.body;
        if (
          ((this.isJson && typeof this._decodedBody !== 'undefined') ||
            (this._decodedBody && typeof this._decodedBody === 'object')) &&
          (typeof Buffer === 'undefined' || !Buffer.isBuffer(this._decodedBody))
        ) {
          try {
            this._decodedBody = JSON.stringify(this._decodedBody);
          } catch (e) {}
        }
      }
    }
    return this._decodedBody;
  },
  set(decodedBody) {
    this._unchunkedBody = null;
    this._decodedBody = decodedBody;
    this._body = null;
    this._rawBody = null;
    this._parts = null;
  }
});

Object.defineProperty(Message.prototype, 'unchunkedBody', {
  enumerable: true,
  get() {
    if (!isDefined(this._unchunkedBody)) {
      if (isDefined(this._rawBody)) {
        this._unchunkedBody = this._rawBody;
        const transferEncoding = this.headers.get('Transfer-Encoding');
        if (transferEncoding && transferEncoding === 'chunked') {
          try {
            this._unchunkedBody = decodeChunkedTransferEncoding(
              this._unchunkedBody
            );
          } catch (e) {}
        }
      } else if (
        isDefined(this._body) ||
        isDefined(this._parts) ||
        isDefined(this._decodedBody)
      ) {
        this._unchunkedBody = this.decodedBody;
        const charset = this.charset;
        if (/^utf-?8$/i.test(charset) && typeof Buffer !== 'undefined') {
          this._unchunkedBody = Buffer.from(this._unchunkedBody, 'utf-8');
        } else if (
          iconvLite.encodingExists(charset) &&
          !/^utf-?8$/i.test(charset)
        ) {
          this._unchunkedBody = iconvLite.encode(this._unchunkedBody, charset);
        }
        let contentTransferEncoding = this.headers.get(
          'Content-Transfer-Encoding'
        );
        if (contentTransferEncoding) {
          contentTransferEncoding = contentTransferEncoding
            .trim()
            .toLowerCase();
          if (contentTransferEncoding === 'base64') {
            if (typeof Buffer !== 'undefined') {
              if (!Buffer.isBuffer(this._unchunkedBody)) {
                this._unchunkedBody = Buffer.from(this._unchunkedBody, 'utf-8');
              }
              this._unchunkedBody = this.rawBody.toString('base64');
            } else {
              this._unchunkedBody = btoa(this._unchunkedBody);
            }
          } else if (contentTransferEncoding === 'quoted-printable') {
            if (
              typeof Buffer !== 'undefined' &&
              Buffer.isBuffer(this._unchunkedBody)
            ) {
              this._unchunkedBody = this._unchunkedBody.toString('binary');
            }
            this._unchunkedBody = quotedPrintable.encode(this._unchunkedBody);
          }
        }
        if (zlib && zlib.gzipSync) {
          let contentEncoding = this.headers.get('Content-Encoding');
          if (contentEncoding) {
            contentEncoding = contentEncoding.trim().toLowerCase();
            if (contentEncoding === 'gzip' || contentEncoding === 'deflate') {
              try {
                this._unchunkedBody = zlib[
                  contentEncoding === 'gzip' ? 'gzipSync' : 'deflateSync'
                ](this._unchunkedBody || '');
              } catch (e) {}
            }
          }
        }
      }
    }
    return this._unchunkedBody;
  },
  set(unchunkedBody) {
    this._unchunkedBody = unchunkedBody;
    this._decodedBody = null;
    this._body = null;
    this._rawBody = null;
    this._parts = null;
  }
});

Object.defineProperty(Message.prototype, 'rawBody', {
  enumerable: true,
  get() {
    if (
      !isDefined(this._rawBody) &&
      (isDefined(this._body) ||
        isDefined(this._parts) ||
        isDefined(this._unchunkedBody) ||
        isDefined(this._decodedBody))
    ) {
      this._rawBody = this.unchunkedBody;
      const transferEncoding = this.headers.get('Transfer-Encoding');
      if (transferEncoding && transferEncoding === 'chunked') {
        if (typeof Buffer !== 'undefined' && !Buffer.isBuffer(this._rawBody)) {
          this._rawBody = Buffer.from(this._rawBody, 'utf-8');
        }
        const chunks = [];
        if (this._rawBody.length > 0) {
          chunks.push(
            Buffer.from(`${this._rawBody.length.toString(16)}\r\n`, 'ascii'),
            this._rawBody,
            Buffer.from('\r\n', 'ascii')
          );
        }
        chunks.push(Buffer.from('0\r\n\r\n', 'ascii'));
        this._rawBody = Buffer.concat(chunks);
      }
    }
    return this._rawBody;
  },
  set(rawBody) {
    this._rawBody = rawBody;
    this._unchunkedBody = null;
    this._decodedBody = null;
    this._body = null;
    this._parts = null;
  }
});

Object.defineProperty(Message.prototype, 'body', {
  enumerable: true,
  get() {
    if (this._parts) {
      if (this._parts.length === 0) {
        return;
      } else {
        const boundary = this.boundary || '';
        if (this._bodyMustBeBuffer) {
          const chunks = [];

          this._parts.forEach(function(part, i) {
            if (i > 0) {
              chunks.push(Buffer.from('\r\n'));
            }
            chunks.push(Buffer.from(`--${boundary}\r\n`));
            let serializedPart = part.serialize();
            if (!Buffer.isBuffer(serializedPart)) {
              serializedPart = Buffer.from(serializedPart);
            }
            chunks.push(serializedPart);
          }, this);

          chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
          return Buffer.concat(chunks);
        } else {
          return `--${boundary}\r\n${this._parts.join(
            `\r\n--${boundary}\r\n`
          )}\r\n--${boundary}--\r\n`;
        }
      }
    } else if (
      !isDefined(this._body) &&
      (isDefined(this._rawBody) ||
        isDefined(this._unchunkedBody) ||
        isDefined(this._decodedBody))
    ) {
      this._body = this.decodedBody;
      if (this.isJson && typeof this._body === 'string') {
        try {
          this._body = JSON.parse(this._body);
        } catch (e) {}
      }
    }
    return this._body;
  },
  set(body) {
    this._body = body;
    if (this.isJson && typeof this._body === 'string') {
      try {
        this._body = JSON.parse(this._body);
      } catch (e) {}
    }
    this._rawBody = null;
    this._unchunkedBody = null;
    this._decodedBody = null;
    this._parts = null;
  }
});

Object.defineProperty(Message.prototype, 'parts', {
  enumerable: true,
  set(parts) {
    this._parts = parts;
    this._body = null;
    this._rawBody = null;
    this._unchunkedBody = null;
    this._decodedBody = null;
  },
  get() {
    if (!this._parts && this.isMultipart) {
      const boundary = this.boundary || '';
      let bodyAsString;
      if (typeof Buffer === 'function' && Buffer.isBuffer(this.body)) {
        bodyAsString = this.body.toString('ascii');
      } else {
        bodyAsString = this.body;
      }
      const boundaryRegExp = new RegExp(
        `(^|\r\n?|\n\r?)--${quoteRegExp(boundary)}(--)?(?:\r\n?|\n\r?|$)`,
        'g'
      );
      let startIndex = -1;
      const parts = [];
      let match;
      // TODO: Basic validation of end marker etc.
      while ((match = boundaryRegExp.exec(bodyAsString))) {
        const index = match.index;
        if (startIndex !== -1) {
          parts.push(new Message(this.body.slice(startIndex, index)));
        }
        startIndex = index + match[0].length;
      }
      if (parts.length > 0) {
        this._parts = parts;
      }
    }
    return this._parts;
  }
});

Object.defineProperty(Message.prototype, 'fileName', {
  get() {
    return (
      this.headers.parameter('Content-Disposition', 'filename') ||
      (this.isMessyMail && this.headers.parameter('Content-Type', 'name'))
    );
  },
  set(fileName) {
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

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

function isNonBufferNonRegExpObject(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    (typeof Buffer === 'undefined' || !Buffer.isBuffer(obj)) &&
    !isRegExp(obj)
  );
}

Message.prototype.clone = function() {
  return new Message({
    headers: this.headers.clone(),
    body: this.body // Not sure
  });
};

Message.prototype.serialize = function(maxLineLength, forceString) {
  if (typeof maxLineLength === 'undefined') {
    maxLineLength = 72;
  }
  let result = this.headers.toString(maxLineLength);
  if (typeof this.body !== 'undefined') {
    result += '\r\n';
    if (
      this.body &&
      typeof this.body === 'object' &&
      isNonBufferNonRegExpObject(this.body)
    ) {
      result += JSON.stringify(this.body);
    } else {
      if (!forceString && this._bodyMustBeBuffer) {
        result = Buffer.concat([Buffer.from(result), this.body]);
      } else {
        result += this.body;
      }
    }
  }
  return result;
};

Message.prototype.toString = function(maxLineLength) {
  return this.serialize(maxLineLength, true);
};

Message.prototype.equals = function(other) {
  return (
    this === other ||
    (this.headers.equals(other.headers) &&
      (this.body === other.body ||
        (typeof Buffer === 'function' &&
          Buffer.isBuffer(this.body) &&
          Buffer.isBuffer(other.body) &&
          buffersEqual(this.body, other.body))))
  );
};

Message.prototype.hasEmptyBody = function() {
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

Message.prototype.toJSON = function() {
  const obj = {};
  if (this.headers.getNames().length > 0) {
    obj.headers = this.headers.toJSON();
  }
  bodyPropertyNames.some(function(bodyPropertyName) {
    let propertyValue = this[`_${bodyPropertyName}`];
    if (propertyValue !== null && typeof propertyValue !== 'undefined') {
      // An empty string is OK, but we use both null and undefined
      if (bodyPropertyName === 'parts') {
        propertyValue = propertyValue.map(function(part) {
          return part.toJSON();
        });
      }
      obj[bodyPropertyName] = propertyValue;
      return true;
    }
  }, this);
  return obj;
};

module.exports = Message;

const foldHeaderLine = require('./foldHeaderLine');
const formatHeaderName = require('./formatHeaderName');
const isRegExp = require('./isRegExp');
const rfc2231 = require('rfc2231');

function Headers(obj, doNotStringify) {
  this.namesWithCase = {};
  this.valuesByName = {};
  this.populate(obj, doNotStringify);
}

Headers.prototype.isMessyHeaders = true;

Headers.prototype.serializeHeaderValue = function(parsedHeaderValue) {
  return parsedHeaderValue;
};

Headers.prototype.parseHeaderValue = function(serializedHeaderValue) {
  return String(serializedHeaderValue);
};

Headers.prototype.populate = function(obj, doNotStringify) {
  if (typeof obj === 'string') {
    this.populateFromString(obj);
  } else if (obj && typeof obj === 'object') {
    if (obj instanceof Headers) {
      this.populateFromObject(obj.valuesByName, doNotStringify);
    } else {
      this.populateFromObject(obj, doNotStringify);
    }
  }
  return this;
};

Headers.prototype.populateFromString = function(str) {
  this.populateFromStringAndReturnBodyStartIndex(str);
  return this;
};

Headers.prototype.populateFromStringAndReturnBodyStartIndex = function(str) {
  const that = this;
  let state = 'startLine';
  let currentHeaderName = '';
  let currentValue = '';

  function flush() {
    if (currentHeaderName.length > 0) {
      that.set(currentHeaderName, currentValue);
    }
    currentHeaderName = '';
    currentValue = '';
    state = 'startLine';
  }
  for (var i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (state === 'startLine') {
      if (ch === ':') {
        state = 'startHeaderValue';
      } else if (ch === '\r' || ch === '\n') {
        // Parse error or terminating CRLFCRLF

        if (
          (ch === '\r' && str[i + 1] === '\n') ||
          (ch === '\n' && str[i + 1] === '\r')
        ) {
          i += 2;
        } else {
          i += 1;
        }
        flush();
        return i;
      } else {
        currentHeaderName += ch;
      }
    } else if (state === 'startHeaderValue' || state === 'headerValue') {
      if (state === 'startHeaderValue') {
        if (ch === ' ') {
          // Ignore space after :
          continue;
        } else {
          state = 'headerValue';
        }
      }
      if (ch === '\r') {
        if (str[i + 1] === '\n') {
          if (/[ \t]/.test(str[i + 2])) {
            // Skip past CRLF fold
            i += 1;
          } else {
            i += 1;
            flush();
          }
        } else if (/[ \t]/.test(str[i + 1])) {
          // Skip past CR fold
        } else {
          flush();
        }
      } else if (ch === '\n') {
        if (str[i + 1] === '\r') {
          if (/[ \t]/.test(str[i + 2])) {
            // Skip past LFCR fold
            i += 1;
          } else {
            i += 1;
            flush();
          }
        } else if (/[ \t]/.test(str[i + 1])) {
          // Skip past LF fold
        } else {
          flush();
        }
      } else {
        currentValue += ch;
      }
    }
  }
  flush();
  return i;
};

Headers.prototype.populateFromObject = function(valuesByName, doNotStringify) {
  Object.keys(valuesByName).forEach(function(headerName) {
    let value = valuesByName[headerName];
    const headerNameLowerCase = headerName.toLowerCase();

    this.namesWithCase[headerNameLowerCase] = headerName;

    if (Array.isArray(value)) {
      if (!doNotStringify) {
        value = value.map(function(serializedHeaderValue) {
          return this.parseHeaderValue(serializedHeaderValue);
        }, this);
      }
      if (this.valuesByName[headerNameLowerCase]) {
        Array.prototype.push.apply(
          this.valuesByName[headerNameLowerCase],
          value
        );
      } else {
        this.valuesByName[headerNameLowerCase] = [].concat(value);
      }
    } else if (typeof value === 'undefined' && !doNotStringify) {
      // Hmm, this might not behave as intended when the header occurs multiple times in the object with different casing
      delete this.valuesByName[headerNameLowerCase];
      delete this.namesWithCase[headerNameLowerCase];
    } else {
      if (!doNotStringify) {
        value = this.parseHeaderValue(value);
      }
      if (this.valuesByName[headerNameLowerCase]) {
        this.valuesByName[headerNameLowerCase].push(value);
      } else {
        this.valuesByName[headerNameLowerCase] = [value];
      }
    }
  }, this);
  return this;
};

Headers.prototype.get = function(headerName, valueNumber) {
  valueNumber = valueNumber || 0;
  const values = this.valuesByName[headerName.toLowerCase()];
  if (values) {
    return values[valueNumber];
  }
};

Headers.prototype.getAll = function(headerName) {
  const values = this.valuesByName[headerName.toLowerCase()];
  if (values) {
    return [].concat(values);
  }
};

Headers.prototype.getNames = function() {
  return Object.keys(this.valuesByName).map(function(lowerCaseHeaderName) {
    return this.namesWithCase[lowerCaseHeaderName];
  }, this);
};

Headers.prototype.getNamesLowerCase = function() {
  return Object.keys(this.valuesByName);
};

Headers.prototype.count = function(headerName) {
  const values = this.valuesByName[headerName.toLowerCase()];
  if (values) {
    return values.length;
  } else {
    return 0;
  }
};

Headers.prototype.set = function(headerName, valueOrValues, valueNumber) {
  if (headerName && typeof headerName === 'object') {
    Object.keys(headerName).forEach(function(key) {
      this.set(key, headerName[key]);
    }, this);
  } else {
    const headerNameLowerCase = headerName.toLowerCase();
    this.namesWithCase[headerNameLowerCase] = headerName;
    if (Array.isArray(valueOrValues)) {
      if (typeof valueNumber !== 'undefined') {
        throw new Error(
          'Headers.set: valueNumber not supported when the values are provided as an array'
        );
      }
      if (valueOrValues.length === 0) {
        delete this.valuesByName[headerNameLowerCase];
        delete this.namesWithCase[headerNameLowerCase];
      } else {
        this.valuesByName[headerNameLowerCase] = valueOrValues.map(function(
          value
        ) {
          return this.parseHeaderValue(value);
        },
        this);
      }
    } else if (
      typeof valueNumber === 'number' &&
      Array.isArray(this.valuesByName[headerNameLowerCase]) &&
      valueNumber < this.valuesByName[headerNameLowerCase].length
    ) {
      this.valuesByName[headerNameLowerCase][
        valueNumber
      ] = this.parseHeaderValue(valueOrValues);
    } else {
      (this.valuesByName[headerNameLowerCase] =
        this.valuesByName[headerNameLowerCase] || []).push(
        this.parseHeaderValue(valueOrValues)
      );
    }
  }
};

Headers.prototype.remove = function(
  headerNameOrObj,
  valueOrValuesOrValueNumber
) {
  let numRemoved = 0;
  if (headerNameOrObj && typeof headerNameOrObj === 'object') {
    Object.keys(headerNameOrObj).forEach(function(headerName) {
      numRemoved += this.remove(headerName, headerNameOrObj[headerName]);
    }, this);
    return numRemoved;
  }
  const headerNameLowerCase = headerNameOrObj.toLowerCase();
  const values = this.valuesByName[headerNameLowerCase];
  if (!values) {
    return 0;
  } else if (typeof valueOrValuesOrValueNumber === 'undefined') {
    delete this.valuesByName[headerNameLowerCase];
    delete this.namesWithCase[headerNameLowerCase];
    return values.length;
  } else if (Array.isArray(valueOrValuesOrValueNumber)) {
    valueOrValuesOrValueNumber.forEach(function(value) {
      numRemoved += this.remove(headerNameLowerCase, value);
    }, this);
    return numRemoved;
  } else if (typeof valueOrValuesOrValueNumber === 'number') {
    if (values.length === 1 && valueOrValuesOrValueNumber === 0) {
      delete this.valuesByName[headerNameLowerCase];
      delete this.namesWithCase[headerNameLowerCase];
      numRemoved = 1;
    } else if (valueOrValuesOrValueNumber < values.length) {
      values.splice(valueOrValuesOrValueNumber, 1);
      numRemoved = 1;
    }
  } else {
    const value = String(valueOrValuesOrValueNumber);
    const index = values.indexOf(value);
    if (index !== -1) {
      if (index === 0 && values.length === 1) {
        delete this.valuesByName[headerNameLowerCase];
        delete this.namesWithCase[headerNameLowerCase];
      } else {
        values.splice(index, 1);
      }
      numRemoved = 1;
    }
  }
  return numRemoved;
};

// has('Content-Length')
// has('Content-Type', 'text/html');
// has('Cookie', ['foo=bar', 'baz=quux']);
Headers.prototype.has = function(headerName, stringOrArrayOrRegExp) {
  const values = this.valuesByName[headerName.toLowerCase()];
  if (typeof stringOrArrayOrRegExp === 'undefined') {
    return !!values;
  } else if (typeof values === 'undefined') {
    return false;
  } else {
    if (Array.isArray(stringOrArrayOrRegExp)) {
      return stringOrArrayOrRegExp.every(function(expectedValue) {
        if (isRegExp(expectedValue)) {
          return values.some(function(value) {
            return expectedValue.test(value);
          });
        } else {
          return values.indexOf(String(expectedValue)) !== -1;
        }
      });
    } else {
      return values.length === 1 && values[0] === String(stringOrArrayOrRegExp);
    }
  }
};

Headers.prototype.parameter = function(
  headerName,
  attributeName,
  attributeValue
) {
  const headerValue = this.get(headerName, 0);
  const rfc2231DisabledForThisHeader =
    this.isMessyHeadersWithRfc2047 &&
    headerName.toLowerCase() === 'content-type';
  if (headerValue) {
    // FIXME: Will break if a quoted parameter value contains a semicolon
    const tokens = headerValue.split(/\s*;\s*/);
    let parameters = {};
    let usesRfc2231 = false;
    for (let i = 1; i < tokens.length; i += 1) {
      const matchKeyValue = tokens[i].match(/^([^=]+)=(.*)$/);
      if (matchKeyValue && !(matchKeyValue[1] in parameters)) {
        const parameterName = matchKeyValue[1];
        let value = matchKeyValue[2];
        const matchQuotedValue = value.match(/^"(.*)"$/);
        if (matchQuotedValue) {
          value = matchQuotedValue[1].replace(/\\/, '');
        }
        if (!usesRfc2231 && /\*$/.test(parameterName)) {
          usesRfc2231 = true;
        }
        parameters[parameterName] = value;
      }
    }
    if (usesRfc2231 && !rfc2231DisabledForThisHeader) {
      parameters = rfc2231.unfoldAndDecodeParameters(parameters);
    }
    if (attributeName) {
      if (attributeValue) {
        parameters[attributeName] = attributeValue;

        const tokensAfterUpdate = [tokens[0]];

        if (!rfc2231DisabledForThisHeader) {
          parameters = rfc2231.encodeAndFoldParameters(parameters);
        }

        Object.keys(parameters).forEach(function(parameterName) {
          tokensAfterUpdate.push(
            `${parameterName}=${parameters[parameterName]}`
          );
        });

        this.set(headerName, tokensAfterUpdate.join('; '), 0);
      } else {
        return parameters[attributeName];
      }
    } else {
      return parameters;
    }
  }
};

Headers.prototype.equals = function(other) {
  if (this === other) {
    return true;
  }
  const headerNames = this.getNamesLowerCase();
  const otherHeaderNames = other.getNamesLowerCase();
  if (headerNames.length !== otherHeaderNames.length) {
    return false;
  }
  headerNames.sort();
  otherHeaderNames.sort();
  for (let i = 0; i < headerNames.length; i += 1) {
    const headerName = headerNames[i];
    if (headerName !== otherHeaderNames[i]) {
      return false;
    }
    const headerValues = this.getAll(headerName);
    const otherHeaderValues = other.getAll(headerName);
    if (headerValues.length !== otherHeaderValues.length) {
      return false;
    }
    if (headerValues.length === 1 && otherHeaderValues.length === 1) {
      if (headerValues[0] !== otherHeaderValues[0]) {
        return false;
      }
    } else {
      headerValues.sort();
      otherHeaderValues.sort();
      for (let j = 0; j < headerValues.length; j += 1) {
        if (headerValues[i] !== otherHeaderValues[i]) {
          return false;
        }
      }
    }
  }
  return true;
};

Headers.prototype.clone = function() {
  const clone = new Headers();
  const lowerCaseHeaderNames = this.getNamesLowerCase();
  lowerCaseHeaderNames.forEach(function(headerName) {
    clone.set(headerName, this.getAll(headerName));
  }, this);
  return clone;
};

Headers.prototype.toString = function(maxLineLength) {
  let result = '';
  const lowerCaseHeaderNames = this.getNamesLowerCase();
  lowerCaseHeaderNames.forEach(function(lowerCaseHeaderName) {
    this.valuesByName[lowerCaseHeaderName].forEach(function(value) {
      result += `${formatHeaderName(lowerCaseHeaderName)}: ${foldHeaderLine(
        this.serializeHeaderValue(value),
        maxLineLength,
        maxLineLength - lowerCaseHeaderName.length - 2
      )}\r\n`;
    }, this);
  }, this);
  return result;
};

Headers.prototype.toCanonicalObject = function() {
  const canonicalObject = {};
  const lowerCaseHeaderNames = this.getNamesLowerCase();
  lowerCaseHeaderNames.forEach(function(lowerCaseHeaderName) {
    canonicalObject[formatHeaderName(lowerCaseHeaderName)] = this.getAll(
      lowerCaseHeaderName
    );
  }, this);
  return canonicalObject;
};

Headers.prototype.toJSON = function() {
  const obj = {};
  const lowerCaseHeaderNames = this.getNamesLowerCase();
  lowerCaseHeaderNames.forEach(function(lowerCaseHeaderName) {
    const values = this.getAll(lowerCaseHeaderName);
    if (values.length === 1) {
      obj[formatHeaderName(lowerCaseHeaderName)] = this.get(
        lowerCaseHeaderName
      );
    } else {
      obj[formatHeaderName(lowerCaseHeaderName)] = this.getAll(
        lowerCaseHeaderName
      );
    }
  }, this);
  return obj;
};

module.exports = Headers;

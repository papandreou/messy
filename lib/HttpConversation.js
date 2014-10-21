var HttpExchange = require('./HttpExchange');

function HttpConversation(obj) {
    obj = obj || {};
    this.exchanges = (obj.exchanges || []).map(function (httpExchange) {
        if (httpExchange instanceof HttpExchange) {
            return httpExchange;
        } else {
            return new HttpExchange(httpExchange);
        }
    });
}

HttpConversation.prototype.clone = function () {
    return new HttpConversation({
        exchanges: this.exchanges.map(function (httpExchange) {
            return httpExchange.clone();
        })
    });
};

HttpConversation.prototype.toString = function (maxLineLength) {
    return this.exchanges.map(function (httpExchange) {
        return httpExchange.toString(maxLineLength);
    }).join('\r\n\r\n');
};

HttpConversation.prototype.equals = function (other) {
    return this === other || (
        other instanceof HttpConversation &&
        this.exchanges.length === other.exchanges.length &&
        this.exchanges.every(function (httpExchange, i) {
            return httpExchange.equals(other.exchanges[i]);
        })
    );
};

module.exports = HttpConversation;

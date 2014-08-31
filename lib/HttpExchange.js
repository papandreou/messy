var HttpRequest = require('./HttpRequest'),
    HttpResponse = require('./HttpResponse');

function HttpExchange(obj) {
    obj = obj || {};
    this.request = obj.request instanceof HttpRequest ? obj.request : new HttpRequest(obj.request);
    this.response = obj.response instanceof HttpResponse ? obj.response : new HttpResponse(obj.response);
}

HttpExchange.prototype.clone = function () {
    return new HttpExchange({
        request: this.request.clone(),
        response: this.response.clone()
    });
};

HttpExchange.prototype.toString = function (maxLineLength) {
    return (
        this.request.toString(maxLineLength) + '\r\n\r\n' +
        this.response.toString(maxLineLength)
    );
};

HttpExchange.prototype.equals = function (other) {
    return (
        other instanceof HttpExchange &&
        this.request.equals(other.request) &&
        this.response.equals(other.response)
    );
};

module.exports = HttpExchange;

/*global describe, it*/
var expect = require('unexpected'),
    Headers = require('../lib/Headers');

describe('Headers', function () {
    it('should fold the lines when serializing', function () {
        var headers = new Headers({subject: 'hey there, dude!'});
        expect(headers.toString(10), 'to equal', 'Subject:\r\n hey\r\n there,\r\n dude!\r\n');
    });

    it('should accept an array header value when instantiating via an Object', function () {
        var headers = new Headers({received: ['foo', 'bar']});

        expect(headers.toString(), 'to equal', 'Received: foo\r\nReceived: bar\r\n');
    });

    it('should accept a string header value', function () {
        var headers = new Headers({received: 'foo'});

        expect(headers.toString(), 'to equal', 'Received: foo\r\n');
    });
});
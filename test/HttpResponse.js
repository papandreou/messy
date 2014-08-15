/*global describe, it*/
var expect = require('unexpected'),
    HttpResponse = require('../lib/HttpResponse');

describe('HttpResponse', function () {
    it('should parse a standalone status line', function () {
        var httpResponse = new HttpResponse('HTTP/1.1 200 OK');
        expect(httpResponse.protocol, 'to equal', 'HTTP/1.1');
        expect(httpResponse.statusCode, 'to equal', 200);
        expect(httpResponse.statusMessage, 'to equal', 'OK');
        expect(httpResponse.toString(), 'to equal', 'HTTP/1.1 200 OK\r\n\r\n');
    });

    it('should parse a status line followed by headers', function () {
        var httpResponse = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n');
        expect(httpResponse.statusCode, 'to equal', 200);
        expect(httpResponse.toString(), 'to equal', 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n');
    });

    it('should parse a status line followed by headers and a body', function () {
        var httpResponse = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah');
        expect(httpResponse.statusCode, 'to equal', 200);
        expect(httpResponse.body, 'to equal', 'blah');
        expect(httpResponse.toString(), 'to equal', 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah');
    });

    it('should accept the status line as an option to the constructor', function () {
        expect(new HttpResponse({statusLine: 'HTTP/1.1 200 OK'}), 'to have properties', {
            protocol: 'HTTP/1.1',
            statusCode: 200,
            statusMessage: 'OK'
        });
    });

    it('should accept the individual status line fields as options to the constructor', function () {
        expect(new HttpResponse({
            protocol: 'HTTP/1.1',
            statusCode: 200,
            statusMessage: 'OK'
        }), 'to have properties', {
            protocol: 'HTTP/1.1',
            statusCode: 200,
            statusMessage: 'OK'
        });
    });

    it('should normalize the protocol and the status code when given as individual options to the constructor', function () {
        expect(new HttpResponse({
            protocol: 'http/1.1',
            statusCode: '200'
        }), 'to have properties', {
            protocol: 'HTTP/1.1',
            statusCode: 200
        });
    });

    it('should consider an identical instance equal', function () {
        var httpResponse1 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah'),
            httpResponse2 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah');
        expect(httpResponse1.equals(httpResponse2), 'to be true');
    });

    it('should consider two instances unequal if they differ by protocol', function () {
        var httpResponse1 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah'),
            httpResponse2 = new HttpResponse('HTTP/1.0 200 OK\r\nContent-Type: text/html\r\n\r\nblah');
        expect(httpResponse1.equals(httpResponse2), 'to be false');
    });

    it('should consider two instances unequal if they differ by status code', function () {
        var httpResponse1 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah'),
            httpResponse2 = new HttpResponse('HTTP/1.1 400 OK\r\nContent-Type: text/html\r\n\r\nblah');
        expect(httpResponse1.equals(httpResponse2), 'to be false');
    });

    it('should consider two instances unequal if they differ by status message', function () {
        var httpResponse1 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah'),
            httpResponse2 = new HttpResponse('HTTP/1.1 200 KO\r\nContent-Type: text/html\r\n\r\nblah');
        expect(httpResponse1.equals(httpResponse2), 'to be false');
    });

    it('should consider two instances unequal if they differ by status message', function () {
        var httpResponse1 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah'),
            httpResponse2 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nblah');
        expect(httpResponse1.equals(httpResponse2), 'to be false');
    });

    it('should consider two instances unequal if they differ by status message', function () {
        var httpResponse1 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nblah'),
            httpResponse2 = new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nquux');
        expect(httpResponse1.equals(httpResponse2), 'to be false');
    });
});

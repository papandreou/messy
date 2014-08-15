/*global describe, it*/
var expect = require('unexpected'),
    HttpRequest = require('../lib/HttpRequest');

describe('HttpRequest', function () {
    it('should parse a standalone request line', function () {
        var httpRequest = new HttpRequest('GET /foo HTTP/1.1');
        expect(httpRequest.method, 'to equal', 'GET');
        expect(httpRequest.url, 'to equal', '/foo');
        expect(httpRequest.protocol, 'to equal', 'HTTP/1.1');
        expect(httpRequest.toString(), 'to equal', 'GET /foo HTTP/1.1\r\n\r\n');
    });

    it('should parse a request line followed by headers', function () {
        var httpRequest = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n');
        expect(httpRequest.url, 'to equal', '/foo');
        expect(httpRequest.toString(), 'to equal', 'GET /foo HTTP/1.1\r\nHost: foo.com\r\n');
    });

    it('should parse a request line followed by headers and a body', function () {
        var httpRequest = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah');
        expect(httpRequest.url, 'to equal', '/foo');
        expect(httpRequest.body, 'to equal', 'blah');
        expect(httpRequest.toString(), 'to equal', 'GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah');
    });

    it('should accept the request line as an option to the constructor', function () {
        expect(new HttpRequest({requestLine: 'GET /foo HTTP/1.1'}), 'to have properties', {
            method: 'GET',
            url: '/foo',
            protocol: 'HTTP/1.1'
        });
    });

    it('should accept the individual request line fields as options to the constructor and normalize them', function () {
        expect(new HttpRequest({
            method: 'get',
            url: '/foo',
            protocol: 'http/1.1'
        }), 'to have properties', {
            method: 'GET',
            url: '/foo',
            protocol: 'HTTP/1.1'
        });
    });

    it('should consider an identical instance equal', function () {
        var httpRequest1 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah'),
            httpRequest2 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah');
        expect(httpRequest1.equals(httpRequest2), 'to be true');
    });

    it('should consider two instances unequal if they differ by method', function () {
        var httpRequest1 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah'),
            httpRequest2 = new HttpRequest('POST /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah');
        expect(httpRequest1.equals(httpRequest2), 'to be false');
    });

    it('should consider two instances unequal if they differ by url', function () {
        var httpRequest1 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah'),
            httpRequest2 = new HttpRequest('GET /bar HTTP/1.1\r\nHost: foo.com\r\n\r\nblah');
        expect(httpRequest1.equals(httpRequest2), 'to be false');
    });

    it('should consider two instances unequal if they differ by protocol', function () {
        var httpRequest1 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah'),
            httpRequest2 = new HttpRequest('GET /foo HTTP/1.0\r\nHost: foo.com\r\n\r\nblah');
        expect(httpRequest1.equals(httpRequest2), 'to be false');
    });

    it('should consider two instances unequal if their headers differ', function () {
        var httpRequest1 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah'),
            httpRequest2 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: bar.com\r\n\r\nblah');
        expect(httpRequest1.equals(httpRequest2), 'to be false');
    });

    it('should consider two instances unequal if their bodies differ', function () {
        var httpRequest1 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: foo.com\r\n\r\nblah'),
            httpRequest2 = new HttpRequest('GET /foo HTTP/1.1\r\nHost: bar.com\r\n\r\nquux');
        expect(httpRequest1.equals(httpRequest2), 'to be false');
    });
});

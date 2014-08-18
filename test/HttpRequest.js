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

    it('should make the request line available as a getter', function () {
        expect(new HttpRequest({
            method: 'GET',
            url: '/foo',
            protocol: 'HTTP/1.1'
        }).requestLine, 'to equal', 'GET /foo HTTP/1.1');
    });

    it('should allow updating the request line via a setter', function () {
        var httpRequest = new HttpRequest({
            method: 'GET',
            url: '/foo',
            protocol: 'HTTP/1.1'
        });
        httpRequest.requestLine = 'PUT /bar HTTP/1.0';
        expect(httpRequest, 'to have properties', {
            method: 'PUT',
            url: '/bar',
            protocol: 'HTTP/1.0'
        });
    });

    it('should make the protocol version available as a getter', function () {
        expect(new HttpRequest('GET /foo HTTP/1.1').protocolVersion, 'to equal', '1.1');
    });

    it('should make the protocol name available as a getter', function () {
        expect(new HttpRequest('GET /foo HTTP/1.1').protocolName, 'to equal', 'HTTP');
    });

    it('should make the components of the request url available as individual getters', function () {
        expect(new HttpRequest('GET /foo?foo=bar HTTP/1.1'), 'to have properties', {
            path: '/foo',
            search: '?foo=bar',
            query: 'foo=bar'
        });
    });

    it('should make path, query, and search available as individual setters', function () {
        var httpRequest = new HttpRequest('GET /foo?foo=bar HTTP/1.1');
        httpRequest.search = '?blabla';
        httpRequest.path = '/bla';
        expect(httpRequest.url, 'to equal', '/bla?blabla');
        httpRequest.query = 'foobar';
        expect(httpRequest.url, 'to equal', '/bla?foobar');
    });

    it('should accept the individual request line fields as options to the constructor', function () {
        expect(new HttpRequest({
            method: 'get',
            url: '/foo',
            protocol: 'http/1.1'
        }).requestLine, 'to equal', 'GET /foo HTTP/1.1');
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

    describe('#satisfies', function () {
        it('should match on properties defined by Message', function () {
            expect(new HttpRequest('GET /foo HTTP/1.1\r\nContent-Type: text/html').satisfies({
                headers: {
                    'Content-Type': 'text/html'
                }
            }), 'to be true');
        });

        it('should fail when matching on properties defined by Message', function () {
            expect(new HttpRequest('GET /foo HTTP/1.1\r\nContent-Type: text/html').satisfies({
                headers: {
                    'Content-Type': 'text/plain'
                }
            }), 'to be false');
        });

        it('should match on properties', function () {
            expect(new HttpRequest('GET /foo HTTP/1.1\r\nContent-Type: text/html').satisfies({
                method: 'GET',
                url: '/foo',
                protocolVersion: '1.1'
            }), 'to be true');
        });

        it('should match exhaustively on properties', function () {
            expect(new HttpRequest('GET /foo?hey HTTP/1.1\r\nContent-Type: text/html').satisfies({
                requestLine: 'GET /foo?hey HTTP/1.1',
                method: 'GET',
                url: '/foo?hey',
                path: '/foo',
                search: '?hey',
                query: 'hey',
                protocol: 'HTTP/1.1',
                protocolName: 'HTTP',
                protocolVersion: '1.1',
                headers: {
                    'Content-Type': 'text/html'
                }
            }, true), 'to be true');
        });

        it('should fail to match exhaustively on properties when a property is omitted', function () {
            expect(new HttpRequest('GET /foo?hey HTTP/1.1\r\nContent-Type: text/html').satisfies({
                requestLine: 'GET /foo?hey HTTP/1.1',
                url: '/foo?hey',
                path: '/foo',
                search: '?hey',
                query: 'hey',
                protocol: 'HTTP/1.1',
                protocolName: 'HTTP',
                protocolVersion: '1.1',
                headers: {
                    'Content-Type': 'text/html'
                }
            }, true), 'to be false');
        });

        it('should fail to match exhaustively on properties when a property defined by Message is omitted', function () {
            expect(new HttpRequest('GET /foo?hey HTTP/1.1\r\nContent-Type: text/html\r\nargh').satisfies({
                requestLine: 'GET /foo?hey HTTP/1.1',
                method: 'GET',
                url: '/foo?hey',
                path: '/foo',
                search: '?hey',
                query: 'hey',
                protocol: 'HTTP/1.1',
                protocolName: 'HTTP',
                protocolVersion: '1.1',
                headers: {
                    'Content-Type': 'text/html'
                }
            }, true), 'to be false');
        });
    });
});

/*global describe, it*/
var expect = require('unexpected'),
    Headers = require('../lib/Headers');

describe('Headers', function () {
    it('should accept a string', function () {
        var headers = new Headers('Subject: hey, dude!');
        expect(headers.get('subject'), 'to equal', 'hey, dude!');
        expect(headers.toString(), 'to equal', 'Subject: hey, dude!\r\n');
    });

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

    describe('#satisfy', function () {
        it('must match an empty object', function () {
            expect(new Headers({foo: 'a'}).satisfy({}), 'to be true');
        });

        it('must match an empty object exhaustively', function () {
            expect(new Headers({}).satisfy({}, true), 'to be true');
        });

        it('must match a single-valued header', function () {
            expect(new Headers({foo: 'a'}).satisfy({foo: 'a'}), 'to be true');
        });

        it('must match a single-valued header specified with a different casing', function () {
            expect(new Headers({Foo: 'a'}).satisfy({fOO: 'a'}), 'to be true');
        });

        it('must match exhaustively when a single header is matched', function () {
            expect(new Headers({foo: 'a'}).satisfy({foo: 'a'}, true), 'to be true');
        });

        it('must match a different value type (should stringify everything)', function () {
            expect(new Headers({foo: '123'}).satisfy({foo: 123}), 'to be true');
            expect(new Headers({foo: 123}).satisfy({foo: '123'}), 'to be true');
        });

        it('should match in spite of excess headers when not matching exhaustively', function () {
            expect(new Headers({foo: 'a', bar: 'a'}).satisfy({foo: 'a'}), 'to be true');
        });

        it('should not match exhaustively when there are excess headers', function () {
            expect(new Headers({foo: 'a', bar: 'a'}).satisfy({foo: 'a'}, true), 'to be false');
        });

        it('should match in spite of excess values when not matching exhaustively', function () {
            expect(new Headers({foo: ['a', 'b']}).satisfy({foo: 'a'}), 'to be true');
        });

        it('should not match exhaustively when there are excess values', function () {
            expect(new Headers({foo: ['a', 'b']}).satisfy({foo: 'a'}, true), 'to be false');
        });

        it('should match multiple values exhaustively', function () {
            expect(new Headers({foo: ['a', 'b']}).satisfy({foo: ['a', 'b']}, true), 'to be true');
        });

        it('should match multiple values exhaustively when ordered differently', function () {
            expect(new Headers({foo: ['a', 'b']}).satisfy({foo: ['b', 'a']}, true), 'to be true');
        });

        it('should not match exhaustively unless all values are actually named', function () {
            expect(new Headers({foo: ['a', 'b']}).satisfy({foo: ['a', 'a']}, true), 'to be false');
        });

        it('should assert the absence of a header when the value is given as undefined', function () {
            expect(new Headers({foo: 'a'}).satisfy({bar: undefined}), 'to be true');
            expect(new Headers({foo: 'a'}).satisfy({foo: undefined}), 'to be false');
        });

        it('should match exhaustively even when absent headers are also asserted absent', function () {
            expect(new Headers({foo: 'a'}).satisfy({foo: 'a', bar: undefined}, true), 'to be true');
        });

        it('should support passing the expected set of headers as a string', function () {
            expect(new Headers({foo: 'a', bar: 'b'}).satisfy('foo: a\r\nbar: b'), 'to be true');
            expect(new Headers({foo: 'a', bar: 'b'}).satisfy('foo: a\r\nbar: b', true), 'to be true');

            expect(new Headers({foo: 'a'}).satisfy('foo: b'), 'to be false');
            expect(new Headers({foo: 'a'}).satisfy(''), 'to be true');
            expect(new Headers({foo: 'a'}).satisfy('', true), 'to be false');
        });
    });
});

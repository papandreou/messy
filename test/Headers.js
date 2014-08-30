/*global describe, it*/
var unexpected = require('unexpected'),
    Headers = require('../lib/Headers');

describe('Headers', function () {
    var expect = unexpected.clone().installPlugin(require('unexpected-messy'));

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

    describe('#remove', function () {
        it('should remove all header values for the given header when only passed one argument', function () {
            var headers = new Headers({foo: ['bla', 'bar'], quux: 'baz'});
            headers.remove('foo');
            expect(headers, 'to equal', new Headers({quux: 'baz'}));
        });

        it('should remove a single header value', function () {
            var headers = new Headers({foo: 'bar', quux: 'baz'});
            headers.remove('foo', 'bar');
            expect(headers, 'to equal', new Headers({quux: 'baz'}));
        });

        it('should remove one out of multiple values', function () {
            var headers = new Headers({foo: ['bar', 'bla'], quux: 'baz'});
            headers.remove('foo', 'bar');
            expect(headers, 'to equal', new Headers({foo: 'bla', quux: 'baz'}));
        });

        it('should remove multiple values, leaving one', function () {
            var headers = new Headers({foo: ['bar', 'bla', 'hey'], quux: 'baz'});
            headers.remove('foo', ['bar', 'hey']);
            expect(headers, 'to equal', new Headers({foo: 'bla', quux: 'baz'}));
        });

        it('should remove multiple values, leaving none', function () {
            var headers = new Headers({foo: ['bla', 'hey'], quux: 'baz'});
            headers.remove('foo', ['hey', 'bla']);
            expect(headers, 'to equal', new Headers({quux: 'baz'}));
            expect(headers.valuesByName.foo, 'to be undefined');
        });

        it('should remove all header values found in object', function () {
            var headers = new Headers({foo: ['bla', 'bar'], quux: 'baz'});
            expect(headers.remove({foo: 'bar', quux: 'baz'}), 'to equal', 2);
            expect(headers, 'to equal', new Headers({foo: 'bla'}));
        });

        it('should remove header value specified by number', function () {
            var headers = new Headers({foo: ['bla', 'bar'], quux: 'baz'});
            expect(headers.remove('foo', 1), 'to equal', 1);
            expect(headers.remove('foo', 1), 'to equal', 0);
            expect(headers, 'to equal', new Headers({foo: 'bla', quux: 'baz'}));
        });

        it('should return the number of removed values when removing all values of a header', function () {
            expect(new Headers({foo: ['bla', 'hey'], quux: 'baz'}).remove('foo'), 'to equal', 2);
        });

        it('should return the number of removed values when removing one out of two', function () {
            expect(new Headers({foo: ['bla', 'hey'], quux: 'baz'}).remove('foo', 'hey'), 'to equal', 1);
        });

        it('should return the number of removed values when removing two out of two', function () {
            expect(new Headers({foo: ['bla', 'hey'], quux: 'baz'}).remove('foo', ['bla', 'hey']), 'to equal', 2);
        });

        it('should return 0 when the attempting to remove a single value that was not found', function () {
            expect(new Headers({foo: 'hey', quux: 'baz'}).remove('foo', 'dah'), 'to equal', 0);
        });

        it('should return 0 when the attempting to remove multiple value that were not found', function () {
            expect(new Headers({foo: 'hey', quux: 'baz'}).remove('foo', ['dah', 'bla']), 'to equal', 0);
        });
    });
});

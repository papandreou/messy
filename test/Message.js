/*global describe, it*/
var unexpected = require('unexpected'),
    Message = require('../lib/Message');

describe('Message', function () {
    var expect = unexpected.clone().installPlugin(require('unexpected-messy'));

    it('should accept an options object with headers and body', function () {
        var message = new Message({
            headers: {
                Received: ['foo', 'bar'],
                Subject: 'hey'
            },
            body: 'abc'
        });
        expect(message.body, 'to equal', 'abc');
        expect(message.headers.getAll('received'), 'to equal', ['foo', 'bar']);
        expect(message.headers.getAll('subject'), 'to equal', ['hey']);
        expect(message.toString(), 'to equal', 'Received: foo\r\nReceived: bar\r\nSubject: hey\r\n\r\nabc');
    });

    it('should parse the headers from the input', function () {
        var message = new Message('From: thisguy@example.com\r\nTo: thisotherguy@example.com');
        expect(message.headers.getNames(), 'to equal', ['from', 'to']);
    });

    it('should support reading a Buffer instance with iso-8859-1 chars', function () {
        var buffer = Buffer.concat([new Buffer('From: ', 'ascii'), new Buffer([0xf8]), new Buffer('foobarquux', 'ascii')]);
        expect(new Message(buffer).headers.get('From'), 'to equal', 'øfoobarquux');
    });

    it('should handle folded lines when parsing', function () {
        var message = new Message('Subject: abc\r\n def');
        expect(message.headers.get('subject'), 'to equal', 'abc def');
    });

    it('should handle folded lines with just CR when parsing', function () {
        var message = new Message('Subject: abc\r def');
        expect(message.headers.get('subject'), 'to equal', 'abc def');
    });

    it('should handle folded lines with just LF when parsing', function () {
        var message = new Message('Subject: abc\n def');
        expect(message.headers.get('subject'), 'to equal', 'abc def');
    });

    it('should handle folded lines + tabs when parsing', function () {
        // Observed on iPhone
        var message = new Message('Subject: abc\r\n\tdef');
        expect(message.headers.get('subject'), 'to equal', 'abc\tdef');
    });

    it('should keep the buffer as a Buffer when the message is provided as a Buffer', function () {
        expect(new Message(Buffer.concat([
            new Buffer(
                'From: foo@bar\r\n' +
                '\r\n',
                'utf-8'
            ),
            new Buffer([0xf8])
        ])), 'to have properties', {
            body: new Buffer([0xf8])
        });
    });

    it('should detect the end of the headers properly when separated by CRCR', function () {
        expect(new Message(Buffer.concat([
            new Buffer('From: foo@bar\r\r', 'utf-8'), new Buffer([0xf8])
        ])), 'to have properties', {
            body: new Buffer([0xf8])
        });

        expect(new Message(new Buffer('From: foo@bar\r\r', 'utf-8')), 'not to have property', 'body');
    });

    it('should detect the end of the headers properly when separated by LFLF', function () {
        expect(new Message(Buffer.concat([
            new Buffer('From: foo@bar\n\n', 'utf-8'), new Buffer([0xf8])
        ])), 'to have properties', {
            body: new Buffer([0xf8])
        });

        expect(new Message(new Buffer('From: foo@bar\n\n', 'utf-8')), 'not to have property', 'body');
    });

    it('should not read past CRLFCRLF when parsing', function () {
        var message = new Message('Subject: abc\r\n\r\nFrom: me');
        expect(message.headers.get('from'), 'to be', undefined);
    });

    it('should not read past CRCR when parsing', function () {
        var message = new Message('Subject: abc\r\rFrom: me');
        expect(message.headers.get('from'), 'to be', undefined);
    });

    it('should not read past LFLF when parsing', function () {
        var message = new Message('Subject: abc\r\rFrom: me');
        expect(message.headers.get('from'), 'to be', undefined);
    });

    it.skip('should rfc2047 decode the header values', function () {
        expect(new Message('Subject: =?iso-8859-1?Q?=A1?=Hola, se=?iso-8859-1?Q?=F1?=or!').get('subject'), 'to equal', '¡Hola, señor!');
    });

    it.skip('should rfc2047 encode when serializing', function () {
        var message = new Message();
        message.set('subject', '¡Hola, señor!');
        expect(message.toString(), 'to equal', 'Subject: =?iso-8859-1?Q?=A1?=Hola, se=?iso-8859-1?Q?=F1?=or!\r\n\r\n');
    });

    it('should produce an empty string when handed an empty buffer', function () {
        expect(new Message(new Buffer(0)).toString(), 'to equal', '');
    });

    it('should parse Real Life message from Apple Mail', function () {
        var message = new Message(new Buffer([
            "Content-Type: multipart/mixed;",
            "\tboundary=Apple-Mail-589ECA5D-7F89-4C39-B7B7-7FD03E6333CD",
            "Content-Transfer-Encoding: 7bit",
            "Subject: Foobar 123",
            "From: foo@example.com",
            "Message-Id: <D37F257C-4EEC-44F2-B279-690B00C4844B@example.com>",
            "Date: Wed, 22 May 2013 14:46:38 +0200",
            'To: "Unittest account" <foo@example.com>',
            "Mime-Version: 1.0 (1.0)",
            "",
            "",
            "--Apple-Mail-589ECA5D-7F89-4C39-B7B7-7FD03E6333CD",
            "..."
        ].join('\r\n'), 'utf-8'));

        expect(message.headers.getNames(), 'to equal', ['content-type', 'content-transfer-encoding', 'subject', 'from', 'message-id', 'date', 'to', 'mime-version']);
        expect(message.headers.get('Content-Type'), 'to equal', 'multipart/mixed;\tboundary=Apple-Mail-589ECA5D-7F89-4C39-B7B7-7FD03E6333CD');
        expect(message.headers.get('content-transfer-encoding'), 'to equal', '7bit');
        expect(message.headers.get('Subject'), 'to equal', 'Foobar 123');

        expect(message.toString(), 'to contain', 'multipart\/mixed;\r\n\tboundary=Apple-Mail-589ECA5D-7F89-4C39-B7B7-7FD03E6333CD');
    });

    it('should preserve repeated headers', function () {
        var message = new Message('Received: foo\r\nReceived: bar\r\n');

        expect(message.toString(), 'to equal', 'Received: foo\r\nReceived: bar\r\n');
    });


    it('should preserve text after CRLFCRLF as-is', function () {
        var message = new Message('foo: bar\r\n\r\nthis is the:body');

        expect(message.toString(), 'to equal', 'Foo: bar\r\n\r\nthis is the:body');
    });

    it('should preserve text after CRCR as-is', function () {
        var message = new Message('foo: bar\r\rthis is the:body');

        expect(message.toString(), 'to equal', 'Foo: bar\r\n\r\nthis is the:body');
    });

    it('should preserve text after LFLF as-is', function () {
        var message = new Message('foo: bar\n\nthis is the:body');

        expect(message.toString(), 'to equal', 'Foo: bar\r\n\r\nthis is the:body');
    });

    it('should preserve text after LFCRLFCR as-is', function () {
        var message = new Message('foo: bar\n\r\n\rthis is the:body');

        expect(message.toString(), 'to equal', 'Foo: bar\r\n\r\nthis is the:body');
    });

    it('should read an iso-8859-1 body after LFCRLFCR into a buffer and turn it into REPLACEMENT CHARACTER U+FFFD when serializing as text', function () {
        var message = new Message(Buffer.concat([new Buffer('foo: bar\n\r\n\rthis is the:body', 'utf-8'), new Buffer([0xf8, 0xe6])]));
        expect(message.body, 'to equal', Buffer.concat([new Buffer('this is the:body', 'utf-8'), new Buffer([0xf8, 0xe6])]));
        expect(message.toString(), 'to equal', 'Foo: bar\r\n\r\nthis is the:body\ufffd\ufffd');
    });

    describe('#hasEmptyBody', function () {
        it('should consider a zero length Buffer to be an empty body', function () {
            expect(new Message({body: new Buffer([])}).hasEmptyBody(), 'to be true');
        });

        it('should consider a non-zero length Buffer not to be an empty body', function () {
            expect(new Message({body: new Buffer([123])}).hasEmptyBody(), 'to be false');
        });

        it('should consider the empty string to be an empty body', function () {
            expect(new Message({body: ''}).hasEmptyBody(), 'to be true');
        });

        it('should consider a non-empty string not to be an empty body', function () {
            expect(new Message({body: 'foo'}).hasEmptyBody(), 'to be false');
        });

        it('should consider undefined to be an empty body', function () {
            expect(new Message({body: undefined}).hasEmptyBody(), 'to be true');
        });

        it('should consider an absent body to be empty', function () {
            expect(new Message().hasEmptyBody(), 'to be true');
        });

        it('should consider an empty Object to be a non-empty body', function () {
            expect(new Message({body: {}}).hasEmptyBody(), 'to be false');
        });
    });

    describe('with a multipart body', function () {
        var src =
            'Content-Type: multipart/form-data;\r\n' +
            ' boundary=--------------------------231099812216460892104111\r\n' +
            '\r\n' +
            '----------------------------231099812216460892104111\r\n' +
            'Content-Disposition: form-data; name="recipient"\r\n' +
            '\r\n' +
            'andreas@one.com\r\n' +
            '----------------------------231099812216460892104111\r\n' +
            'Content-Disposition: form-data; name="Name "\r\n' +
            '\r\n' +
            'The name\r\n' +
            '----------------------------231099812216460892104111\r\n' +
            'Content-Disposition: form-data; name="email"\r\n' +
            '\r\n' +
            'the@email.com\r\n' +
            '----------------------------231099812216460892104111\r\n' +
            'Content-Disposition: form-data; name="Message "\r\n' +
            '\r\n' +
            'The message\r\n' +
            '----------------------------231099812216460892104111--\r\n';

        it('should decode the multipart parts when the body is passed as a Buffer', function () {
            var message = new Message(new Buffer(src, 'utf-8'));

            expect(message.toString(), 'to equal', src);

            expect(message, 'to satisfy', {
                body: [
                    new Message('Content-Disposition: form-data; name="recipient"\r\n\r\nandreas@one.com'),
                    new Message('Content-Disposition: form-data; name="Name "\r\n\r\nThe name'),
                    new Message('Content-Disposition: form-data; name="email"\r\n\r\nthe@email.com'),
                    new Message('Content-Disposition: form-data; name="Message "\r\n\r\nThe message')
                ]
            });
        });

        it('should decode the multipart parts when the body is passed as a string', function () {
            expect(new Message(src).body, 'to equal', [
                new Message('Content-Disposition: form-data; name="recipient"\r\n\r\nandreas@one.com'),
                new Message('Content-Disposition: form-data; name="Name "\r\n\r\nThe name'),
                new Message('Content-Disposition: form-data; name="email"\r\n\r\nthe@email.com'),
                new Message('Content-Disposition: form-data; name="Message "\r\n\r\nThe message')
            ]);
        });
    });
});

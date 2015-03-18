/*global describe, it*/
var expect = require('unexpected'),
    Message = require('../lib/Message');

it.skipIf = function (condition) {
    (condition ? it.skip : it).apply(it, Array.prototype.slice.call(arguments, 1));
};

describe('Message', function () {
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

            expect(message.parts, 'to equal', [
                new Message(new Buffer('Content-Disposition: form-data; name="recipient"\r\n\r\nandreas@one.com', 'utf-8')),
                new Message(new Buffer('Content-Disposition: form-data; name="Name "\r\n\r\nThe name', 'utf-8')),
                new Message(new Buffer('Content-Disposition: form-data; name="email"\r\n\r\nthe@email.com', 'utf-8')),
                new Message(new Buffer('Content-Disposition: form-data; name="Message "\r\n\r\nThe message', 'utf-8'))
            ]);
        });

        it('should decode the multipart parts when the body is passed as a string', function () {
            var message = new Message(src);

            expect(message.parts, 'to equal', [
                new Message('Content-Disposition: form-data; name="recipient"\r\n\r\nandreas@one.com'),
                new Message('Content-Disposition: form-data; name="Name "\r\n\r\nThe name'),
                new Message('Content-Disposition: form-data; name="email"\r\n\r\nthe@email.com'),
                new Message('Content-Disposition: form-data; name="Message "\r\n\r\nThe message')
            ]);
        });

        it('#toString should serialize the (possibly mutated) decoded parts if available', function () {
            var message = new Message(src);

            message.parts.splice(1, 3);

            message.parts[0].headers.set('Foo', 'quux');

            expect(
                message.toString(),
                'to equal',
                'Content-Type: multipart/form-data;\r\n' +
                ' boundary=--------------------------231099812216460892104111\r\n' +
                '\r\n' +
                '----------------------------231099812216460892104111\r\n' +
                'Content-Disposition: form-data; name="recipient"\r\n' +
                'Foo: quux\r\n' +
                '\r\n' +
                'andreas@one.com\r\n' +
                '----------------------------231099812216460892104111--\r\n'
            );
        });

        it('should reparse the parts if the body of the containing Message is updated', function () {
            var message = new Message(src);
            message.parts.splice(1, 3);
            message.body = src;
            expect(message.parts, 'to have length', 4);
        });

        it('should support updating the parts property', function () {
            var message = new Message(src);
            message.parts = [];
            expect(message.parts, 'to equal', []);
        });

        it('should recompute the body if the parts are updated', function () {
            var message = new Message(src);
            expect(message.parts, 'to have length', 4);
            message.parts.splice(1, 3);
            expect(message.body, 'to equal',
                '----------------------------231099812216460892104111\r\n' +
                'Content-Disposition: form-data; name="recipient"\r\n' +
                '\r\n' +
                'andreas@one.com\r\n' +
                '----------------------------231099812216460892104111--\r\n');
        });

        it('should recompute the body if the parts are updated, binary mode', function () {
            var message = new Message(src);
            expect(message.parts, 'to have length', 4);
            message.parts[0].body = new Buffer([0]);
            message.parts.splice(1, 3);
            var body = message.body;
            expect(body, 'to be a', Buffer);
            expect(body.toString('utf-8'), 'to equal',
                '----------------------------231099812216460892104111\r\n' +
                'Content-Disposition: form-data; name="recipient"\r\n' +
                '\r\n' +
                '\x00\r\n' +
                '----------------------------231099812216460892104111--\r\n'
            );
        });
    });

    describe('#body', function () {
        it('should decode a base64 body to a string when the Content-Transfer-Encoding is base64 and the Content-Type is textual and the body is stored as a string', function () {
            expect(new Message(
                'Content-Type: text/plain; charset=UTF-8\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                'Zm9v\r\n'
            ).body, 'to equal', 'foo');
        });

        it('should decode a base64 body to a string when the Content-Transfer-Encoding is base64 and the Content-Type is textual and the body is stored as a Buffer', function () {
            expect(new Message(new Buffer(
                'Content-Type: text/plain; charset=UTF-8\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                'Zm9v\r\n')
            ).body, 'to equal', 'foo');
        });

        it('should decode a base64 body to a Buffer when the Content-Transfer-Encoding is base64 and the Content-Type is not textual', function () {
            expect(new Message(
                'Content-Type: image/png; charset=UTF-8\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                'Zm9v\r\n'
            ).body, 'to equal', new Buffer('foo'));
        });

        it('should decode quoted-printable when the Content-Transfer-Encoding header says so', function () {
            expect(new Message(
                'Content-Type: text/plain; charset=UTF-8\r\n' +
                'Content-Transfer-Encoding: quoted-printable\r\n' +
                '\r\n' +
                'Abc =C3=A6=C3=B8=C3=A5\r\n'
            ).body, 'to equal', 'Abc æøå\r\n');
        });

        it('should not break if the Content-Transfer-Encoding is unsupported', function () {
            expect(new Message(
                'Content-Type: image/png; charset=UTF-8\r\n' +
                'Content-Transfer-Encoding: foo\r\n' +
                '\r\n' +
                'Zm9v\r\n'
            ).body, 'to equal', 'Zm9v\r\n');
        });

        it('should support quoted-printable with iso-8859-1', function () {
            expect(new Message(
                'Content-Type: text/plain; charset=iso-8859-1\r\n' +
                'Content-Transfer-Encoding: quoted-printable\r\n' +
                '\r\n' +
                'Abc =F8\r\n'
            ).body, 'to equal', 'Abc ø\r\n');
        });

        it('should provide a decoded body when the body is already given as a string with no Content-Transfer-Encoding, even when a charset is defined', function () {
            expect(new Message(
                'Content-Type: text/plain; charset=UTF-8\r\n' +
                '\r\n' +
                'Abcdef\r\n'
            ).body, 'to equal', 'Abcdef\r\n');
        });

        it('should support quoted-printable with no Content-Transfer-Encoding', function () {
            expect(new Message(
                Buffer.concat([
                    new Buffer(
                        'Content-Type: text/plain; charset=iso-8859-1\r\n' +
                        '\r\n' +
                        'Abc '),
                    new Buffer([0xf8]),
                    new Buffer('\r\n')
                ])
            ).body, 'to equal', 'Abc ø\r\n');
        });

        it('should decode Transfer-Encoding:chunked when the body is provided as a string', function () {
            expect(new Message(
                'Content-Type: text/plain; charset=UTF-8\r\n' +
                'Transfer-Encoding: chunked\r\n' +
                '\r\n' +
                '4\r\n' +
                'Wiki\r\n' +
                '5\r\n' +
                'pedia\r\n' +
                'e\r\n' +
                ' in\r\n\r\nchunks.\r\n' +
                '0\r\n' +
                '\r\n'
            ).body, 'to equal', 'Wikipedia in\r\n\r\nchunks.');
        });

        it('should decode Transfer-Encoding:chunked when the body is provided as a Buffer', function () {
            expect(new Message(
                new Buffer(
                    'Content-Type: text/plain; charset=UTF-8\r\n' +
                    'Transfer-Encoding: chunked\r\n' +
                    '\r\n' +
                    '4\r\n' +
                    'Wiki\r\n' +
                    '5\r\n' +
                    'pedia\r\n' +
                    'e\r\n' +
                    ' in\r\n\r\nchunks.\r\n' +
                    '0\r\n' +
                    '\r\n',
                    'utf-8'
                )
            ).body, 'to equal', 'Wikipedia in\r\n\r\nchunks.');
        });

        it.skipIf(!require('zlib').gunzipSync, 'should decode Content-Encoding:gzip', function () {
            expect(new Message(Buffer.concat([
                new Buffer(
                    'Content-Type: text/plain; charset=UTF-8\r\n' +
                    'Content-Encoding: gzip\r\n' +
                    '\r\n', 'ascii'
                ),
                new Buffer([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x4b, 0xcb, 0xcf, 0x4f, 0x4a, 0x2c, 0x02, 0x00, 0x95, 0x1f, 0xf6, 0x9e, 0x06, 0x00, 0x00, 0x00])
            ])).body, 'to equal', 'foobar');
        });
    });

    describe('#rawBody', function () {
        it('should be populated when instantiating a Message from a string', function () {
            var rawBody = 'Foo: bar\r\n\r\nquux';
            expect(new Message(rawBody).rawBody, 'to equal', 'quux');
        });

        it('should be populated when instantiating a Message from a Buffer', function () {
            var rawBody = new Buffer('Foo: bar\r\n\r\nquux', 'utf-8');
            expect(new Message(rawBody).rawBody, 'to equal', new Buffer('quux', 'utf-8'));
        });

        it('should be recomputed from the body if updated, with Content-Transfer-Encoding', function () {
            var message = new Message(
                'Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\nZm9vYmFy'
            );
            expect(message.rawBody, 'to equal', 'Zm9vYmFy');
            expect(message.body, 'to equal', 'foobar');
            message.body = 'quux';
            expect(message.rawBody, 'to equal', 'cXV1eA==');
        });

        it('should be recomputed from the body if updated, with quoted-printable and a charset', function () {
            var message = new Message(
                'Content-Type: text/plain; charset=iso-8859-1\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nF=E6'
            );
            expect(message.rawBody, 'to equal', 'F=E6');
            expect(message.body, 'to equal', 'Fæ');
            message.body = 'øh';
            expect(message.rawBody, 'to equal', '=F8h');
        });

        it('should be recomputed from the body if updated, with transfer-encoding: chunked', function () {
            var message = new Message(
                'Content-Type: text/plain; charset=utf-8\r\n' +
                'Transfer-Encoding: chunked\r\n\r\n' +
                '4\r\n' +
                'Wiki\r\n' +
                '0\r\n' +
                '\r\n'
            );
            expect(message.rawBody, 'to equal', '4\r\nWiki\r\n0\r\n\r\n');
            expect(message.body, 'to equal', 'Wiki');
            message.body = 'sarbarbarbab';
            expect(message.rawBody, 'to equal', new Buffer('c\r\nsarbarbarbab\r\n0\r\n\r\n'));
            expect(message.body, 'to equal', 'sarbarbarbab');
        });

        it.skipIf(!require('zlib').gzipSync, 'should be recomputed from the body if updated, with Content-Encoding:gzip', function () {
            var message = new Message(Buffer.concat([
                new Buffer(
                    'Content-Type: text/plain; charset=UTF-8\r\n' +
                    'Content-Encoding: gzip\r\n' +
                    '\r\n', 'ascii'
                ),
                new Buffer([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x4b, 0xcb, 0xcf, 0x4f, 0x4a, 0x2c, 0x02, 0x00, 0x95, 0x1f, 0xf6, 0x9e, 0x06, 0x00, 0x00, 0x00])
            ]));
            expect(message.body, 'to equal', 'foobar');
            message.body = 'barfoo';
            expect(message.rawBody, 'to equal', new Buffer([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x4b, 0x4a, 0x2c, 0x4a, 0xcb, 0xcf, 0x07, 0x00, 0x2b, 0x85, 0xa8, 0xe2, 0x06, 0x00, 0x00, 0x00]));
            expect(message.body, 'to equal', 'barfoo');
        });
    });

    describe('#fileName', function () {
        describe('when invoked as a getter', function () {
            it('should decode the Content-Disposition filename', function () {
                var message = new Message(
                    'Content-Disposition: attachment;\r\n' +
                    ' filename*0*=utf-8\'\'%72%C3%A6%61%6C%6C%79%20%73%63%72%65%77%65%64%20%75;\r\n' +
                    ' filename*1*=%70%20%6C%6F%6E%67%20%61%74%74%61%63%68%6D%65%6E%74%20%66%69;\r\n' +
                    ' filename*2*=%6C%65%6E%61%6D%65%20%77%69%74%68%20%73%6D%69%6C%65%79%73%E2;\r\n' +
                    ' filename*3*=%98%BA%20%61%6E%64%20%E2%98%BA%61%6E%64%20%C2%A1%48%6F%6C%61;\r\n' +
                    ' filename*4*=%2C%20%73%65%C3%B1%6F%72%21%20%61%6E%64%20%66%6F%72%65%69%67;\r\n' +
                    ' filename*5*=%6E%20%77%65%69%72%64%6E%65%73%73%D7%9D%D7%95%D7%9C%D7%A9%20;\r\n' +
                    ' filename*6*=%D7%9F%D7%91%20%D7%99%D7%9C%D7%98%D7%A4%D7%A0%20%69%6E%20%69;\r\n' +
                    ' filename*7*=%74%2E%E2%98%BA');
                expect(message.fileName, 'to equal', 'ræally screwed up long attachment filename with smileys☺ and ☺and ¡Hola, señor! and foreign weirdnessםולש ןב ילטפנ in it.☺');
            });

            it('should not fall back to the name property of the Content-Type header when the Content-Disposition header has no filename parameter', function () {
                var message = new Message(
                    'Content-Transfer-Encoding: base64\r\n' +
                    'Content-Disposition: attachment\r\n' +
                    'Content-Type: image/png; name="=?iso-8859-1?Q?=E6=F8=E5.png?="'
                );
                expect(message.fileName, 'to equal', undefined);
            });

            it('should not fall back to the name property of the Content-Type header when there is no Content-Disposition header', function () {
                var message = new Message(
                    'Content-Transfer-Encoding: base64\r\n' +
                    'Content-Type: image/png; name="=?iso-8859-1?Q?=E6=F8=E5.png?="'
                );
                expect(message.fileName, 'to equal', undefined);
            });
        });

        describe('when invoked as a setter', function () {
            it('should support a fileName setter which updates the Content-Disposition filename with the rfc2231 encoded representation', function () {
                var message = new Message({body: 'bar'});
                message.fileName = 'ræally screwed up long attachment filename with smileys☺ and ☺and ¡Hola, señor! and foreign weirdnessםולש ןב ילטפנ in it.☺';
                expect(
                    message.toString(),
                    'to equal',
                    'Content-Disposition: attachment;\r\n' +
                    ' filename*0*=utf-8\'\'%72%C3%A6%61%6C%6C%79%20%73%63%72%65%77%65%64%20%75;\r\n' +
                    ' filename*1*=%70%20%6C%6F%6E%67%20%61%74%74%61%63%68%6D%65%6E%74%20%66%69;\r\n' +
                    ' filename*2*=%6C%65%6E%61%6D%65%20%77%69%74%68%20%73%6D%69%6C%65%79%73%E2;\r\n' +
                    ' filename*3*=%98%BA%20%61%6E%64%20%E2%98%BA%61%6E%64%20%C2%A1%48%6F%6C%61;\r\n' +
                    ' filename*4*=%2C%20%73%65%C3%B1%6F%72%21%20%61%6E%64%20%66%6F%72%65%69%67;\r\n' +
                    ' filename*5*=%6E%20%77%65%69%72%64%6E%65%73%73%D7%9D%D7%95%D7%9C%D7%A9%20;\r\n' +
                    ' filename*6*=%D7%9F%D7%91%20%D7%99%D7%9C%D7%98%D7%A4%D7%A0%20%69%6E%20%69;\r\n' +
                    ' filename*7*=%74%2E%E2%98%BA\r\n' +
                    '\r\n' +
                    'bar'
                );
            });

            it('should not update the name property of the Content-Type header, even if available', function () {
                var message = new Message({headers: {'Content-Type': 'image/png'}});
                message.fileName = 'æøå.png';
                expect(
                    message.toString(),
                    'to equal',
                    'Content-Type: image/png\r\n' +
                    'Content-Disposition: attachment;\r\n' +
                    " filename*=iso-8859-1''%E6%F8%E5%2E%70%6E%67\r\n"
                );
            });
        });
    });
});

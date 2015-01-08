/*global describe, it*/
var expect = require('unexpected'),
    Mail = require('../lib/Mail');

describe('Mail', function () {
    it('should rfc2047 decode the header values', function () {
        var mail = new Mail('Subject: =?iso-8859-1?Q?=A1?=Hola, se=?iso-8859-1?Q?=F1?=or!');
        expect(mail.headers.get('subject'), 'to equal', '¡Hola, señor!');
    });

    it('should rfc2047 encode when serializing', function () {
        var mail = new Mail({body: 'bar'});
        mail.headers.set('subject', '¡Hola, señor!');
        expect(mail.toString(), 'to equal', 'Subject: =?iso-8859-1?Q?=A1Hola=2C?= =?iso-8859-1?Q?_se=F1or!?=\r\n\r\nbar');
    });
});

const Message = require("./Message");
const HeadersWithRfc2047 = require("./HeadersWithRfc2047");
const util = require("util");

function Mail(obj) {
  Message.call(this, obj);
}

util.inherits(Mail, Message);

Mail.prototype.isMessyMail = true;

Mail.prototype.HeadersConstructor = HeadersWithRfc2047;

module.exports = Mail;

var TransformStream = require('stream').Transform,
	util = require('util'),
	utils = require('./utils');

var HEADERS_END = new Buffer('\r\n\r\n', 'ascii');

function MimeStream() {
	
	if (!(this instanceof MimeStream)) return new MimeStream();
	
	TransformStream.call(this);
	
	this.headerbuffer = [];
	this.headers = {};
	
};

util.inherits(MimeStream, TransformStream);

MimeStream.prototype.is = function(m) {
	
	if (this.mime) {
		var ct = this.mime.split('/');
		var mime = m.split('/');
		return ((mime[0] == ct[0] || mime[0] == '*') && (mime[1] == ct[1] || mime[1] == '*'));
	}
	
	return false;
	
};

MimeStream.prototype._enc = function(enc) {
	console.log('encoding ' + enc);
	this.setEncoding(enc);
};

MimeStream.prototype._transform = function(chunk, encoding, done) {
		
	if (this.headerbuffer) {
		
		this.headerbuffer.push(chunk);
		var b = Buffer.concat(this.headerbuffer);
		var headerEnd = b.indexOf(HEADERS_END);
		if (headerEnd > -1) {
			
			this.headersParsed = true;
			
			var headers = b.slice(0, headerEnd).toString('utf8').split(/\r\n/);
			
			for (var i in headers) {
				var header = headers[i];
				var h = /^([\w-]+): (.*?)$/.exec(header);
				this.headers[h[1].toLowerCase()] = h[2];
			}
			
			switch ((this.headers['content-transfer-encoding'] || '').split(/: ?/)[0].toLowerCase()) {
				case 'base64':
					this._enc('base64');
					break;
				case 'binary':
					this._enc('binary');
					break;
				case '7bit':
				case '8bit':
				case 'utf8':
					this._enc('utf8');
					break;
			}
			
			this.filename = utils.values(this.headers['content-disposition'])['filename'];
			this.mime = utils.mime(this.headers);
			
			this.emit('headers', this.headers);
			
			this.push(b.slice(headerEnd + 4));
			this.headerbuffer = null;
			
		}
		
	} else this.push(chunk);
	done();
	
};

module.exports = MimeStream;

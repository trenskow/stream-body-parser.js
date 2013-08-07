var util = require('util'),
	utils = require('./utils'),
	MimeStream = require('./mime-stream');

var WritableStream = require('stream').Writable;

var CRLF = new Buffer('\r\n', 'ascii');
var END = new Buffer('--\r\n', 'ascii');

function BoundaryStream(boundary, options) {
	
	WritableStream.call(this, options);
	
	this.boundary = Buffer.concat([ new Buffer('--', 'ascii'), boundary ]);
	this.lookback = null;
	this.stream = null;
	this.first = true;
	
};

util.inherits(BoundaryStream, WritableStream);

BoundaryStream.prototype._nextBoundary = function(chunk, start, done) {
	
	var self = this;
	
	start = start || 0;
	end = Math.min(chunk.length - self.boundary.length - 8, chunk.length);
	
	var pos = chunk.indexOf(self.boundary, start);
	
	if (pos > -1) {
		
		var _next = function() {
			
			var nextOffset = start + pos + self.boundary.length;
			
			if (chunk.length - nextOffset >= 2 && chunk.indexOf(CRLF, nextOffset, CRLF.length) == 0) {
				self.stream = new MimeStream();
				self.emit('part', self.stream);
				self._nextBoundary(chunk, nextOffset + 2, done);
			} else if (chunk.length - nextOffset >= 2 && chunk.indexOf(END, nextOffset, END.length) == 0) {
				done(nextOffset + 4);
			}
			
		};
		
		/* End previous stream */
		if (self.stream) {
			self.stream.write(chunk.slice(start, start + pos - 2), null, function() {
				self.stream.end();
				self.stream = null;
				_next();
			});
		}
		else _next();
		
	} else if (self.stream) {
		self.stream.write(chunk.slice(start, end), null, function() {
			done(end);
		});
	} else done(end);
	
};

BoundaryStream.prototype._write = function(chunk, encoding, done) {
	
	var self = this;
	
	if (self.lookback) chunk = Buffer.concat([ self.lookback, chunk ]);
	self.lookback = null;
	
	var pos = self._nextBoundary(chunk, 0, function(pos) {
		if (chunk.length - pos > 0) {
			self.lookback = new Buffer(chunk.length - pos);
			chunk.copy(self.lookback, 0, pos);
		}
		done();
	});
	
};

module.exports = BoundaryStream;

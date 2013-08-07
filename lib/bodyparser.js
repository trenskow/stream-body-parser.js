var fs = require('fs'),
	utils = require('./utils'),
	BoundaryStream = require('./boundary-stream'),
	connectBodyParser = require('connect').bodyParser;

var StreamBodyParser = function(options, app) {
	
	if (!(this instanceof StreamBodyParser)) return new StreamBodyParser(app, options);
	
	options = options || {};
	
	this._bodyProcessors = { };
	
	this.process = function(path, fn) {
		this._bodyProcessors[path] = this._bodyProcessors[path] || [];
		this._bodyProcessors[path].push(fn);
	};
	
	this.default = function(fn) {
		this._default = fn;
	};
	
	if ('string' == typeof options.uploadDir) {
		this._default = function(stream, req, next) {
			req.files = req.files || [];
			var file = {
				path: options.uploadDir,
				name: stream.filename,
				type: stream.mime,
				size: 0
			};
			req.files.push(file);
			stream.on('data', function(data) {
				file.size += data.length;
			});
			stream.on('end', next);
			stream.pipe(fs.createWriteStream(options.uploadDir + '/' + stream.filename));
		};
	};
	
	var self = this;
		
	this.middleware = function() {
		
		return function(req, res, next) {
			
			/* Ignore GET and HEAD requests. */
			if (req.method == 'GET' || req.method == 'HEAD') return next();
			/* Ignore non multipart/form-data requests. */
			if (utils.mime(req.headers) != 'multipart/form-data') return next();
			
			var opt = utils.values(req.headers['content-type']);
			
			/* Ignore if no boundary is set. */
			if (!opt.boundary) return next();
			
			/* We implement next as a simple counter. Once the counter 
			   hits zero, we are ready to proceed to next route. */
			
			var n = {
				next: next,
				finished: false,
				count: 0
			};
			
			/* This is the function that will be passed on as next */
			var _cb = function() {
				n.count--;
				if (n.next && n.finished && !n.count) {
					n.next();
					n.next = null;
				}
			};
			
			var boundaryStream = new BoundaryStream(new Buffer(opt.boundary, 'ascii'));
			
			boundaryStream.on('part', function(stream) {
				
				stream.on('headers', function(headers) {
										
					if (utils.mime(headers) == '') {
						n.count++;
						stream.on('data', function(chunk) {
							req.body = req.body || {};
							var name = utils.values(headers['content-disposition'])['name'];
							req.body[name] = req.body[name] || '';
							req.body[name] += chunk.toString('utf8');
						});
						stream.on('end', function(chunk) {
							_cb();
						});
					} else {
						var handled = false;
						for (var mime in self._bodyProcessors) {
							if (stream.is(mime)) {
								handled = true;
								self._bodyProcessors[mime].forEach(function(fn) {
									n.count++;
									fn(stream, req, _cb);
								});
							}
						}
						if (!handled && 'function' == typeof self._default) self._default(stream, req, _cb);
					}
					
				});
				
			});
			
			req.pipe(boundaryStream);
			
			n.count++;
			boundaryStream.on('finish', function() {
				n.finished = true;
				_cb();
			});
			
		};
		
	};
	
	if (app) {
		/* Configure as middleware */
		app.use(this.middleware());
		/* Put connect bodyParser as next middleware for fallback. */
		app.use(connectBodyParser(options));
	}
	
};

module.exports = StreamBodyParser;

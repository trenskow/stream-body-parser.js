var fs = require('fs'),
	utils = require('./utils'),
	BoundaryStream = require('./boundary-stream'),
	connect = require('connect');

var StreamBodyParser = function(app, options) {
	
	if (!(this instanceof StreamBodyParser)) return new StreamBodyParser(app, options);
	
	if (!app) throw new Error('Provide connect.js or express.js application.');
	
	var self = this;
	
	options = options || { };
	
	this._bodyProcessors = { };
	
	/* Configures a process callback for a givin' mime type */
	this.process = function(mime, fn) {
		
		if ('function' == typeof mime) {
			fn = mime;
			mime = '*/*'
		}
		
		this._bodyProcessors[mime] = this._bodyProcessors[mime] || [];
		this._bodyProcessors[mime].push(fn);
	};
	
	/* If options.uploadDir is provided, configure a default processor that saves streams to uploadDir */
	if ('string' == typeof options.uploadDir) {
		this.process(function(stream, req, next) {
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
		});
	};
	
	/* Middleware for configuring connect or express manually. */
	this.middleware = function() {
		
		var connectBodyParser = connect.bodyParser(options);
		
		return function(req, res, next) {
			
			/* Ignore GET and HEAD requests. */
			if (req.method == 'GET' || req.method == 'HEAD') return next();
			/* Non multipart/form-data requests are sent to connect's bodyparser. */
			if (utils.mime(req.headers) != 'multipart/form-data') return connectBodyParser(req, res, next);
			
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
			var _next = function() {
				n.count--;
				if (n.next && n.finished && !n.count) {
					n.next();
					n.next = null;
				}
			};
			
			var boundaryStream = new BoundaryStream(new Buffer(opt.boundary, 'ascii'));
			
			boundaryStream.on('part', function(stream) {
				
				stream.on('headers', function(headers) {
					
					n.count++;
					/* Handle key/value parts */
					if (utils.mime(headers) == '') {
						n.count++;
						stream.on('data', function(chunk) {
							req.body = req.body || {};
							var name = utils.values(headers['content-disposition'])['name'];
							req.body[name] = req.body[name] || '';
							req.body[name] += chunk.toString('utf8');
						});
						stream.on('end', function(chunk) {
							_next();
						});
					} else {
						/* Handle file uploads to processors */
						for (var mime in self._bodyProcessors) {
							if (stream.is(mime)) {
								self._bodyProcessors[mime].forEach(function(fn) {
									n.count++;
									fn(stream, req, _next);
								});
							}
						}
					}
					_next();
					
				});
				
			});
			
			req.pipe(boundaryStream);
			
			n.count++;
			boundaryStream.on('finish', function() {
				n.finished = true;
				_next();
			});
			
		};
		
	};
	
	if (app) {
		/* Assign the bodyParser app */
		app.streamBodyParser = self;
		/* Configure as middleware */
		app.use(this.middleware());
	}
	
};

module.exports = StreamBodyParser;

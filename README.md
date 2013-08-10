#stream-body-parser.js
**Parse multipart/form-data as streams - processing doing upload**

##Introduction

This is a (partial) drop-in for the bodyParser in connect.js and express.js. But instead of just being able to upload files to a directory, it directly access the upload stream, as it being uploaded. Thereby you can redirect the uploaded files to another destination than just the disk - being it a database or simply processing the data as it is being uploaded.

I've created this in order to make video upload service, that automatically transcodes the videos to a specific format on upload. Thereby having the video available in the desired format, already when the user finishes uploading.

So together with [stream-transcoder.js](https://github.com/trenskow/stream-transcoder.js), you are able to do stuff like this.

**stream-body-parser will default back to connect.js/express.js's bodyParser, when non multipart/form-data data is being posted.**

    var express = require('express'),
        StreamBodyParser = require('stream-body-parser'),
        Transcoder = require('stream-transcoder');
    
    var app = express();
    
    var bodyParser = new StreamBodyParser(app);
    
    bodyParser.process('video/*', function(stream, req, next) {
    	
    	var myGridFSWriteStream = (Some MongoDB GridFS stream)
    	
    	new Transcoder(stream)
    	    .maxSize(320, 240)
    	    .videoCodec('h264')
    	    .videoBitrate(800 * 1000)
    	    .fps(25)
    	    .audioCodec('libfaac')
    	    .sampleRate(44100)
    	    .channels(2)
    	    .audioBitrate(128 * 1000)
    	    .format('mp4')
    	    .on('finish', function() {
    	    	next();
    	    })
    	    .stream().pipe(myGridFSWriteStream);
    	
    });
    
    app.post('/', function(req, res) {
    	res.send(200); // File uploaded
    });
    
    app.listen(3000);

In the above example the video is transcoded as it is being uploaded, and then piped directly into the database. So when the route is being called, the video is transcoded and stored.

## Class StreamBodyParser
This class provides incoming uploaded files as streams, as soon as the request has been made - but before the upload has started.

### new StreamBodyParser(app, [options])

  * `app` Object - express.js or connect.js app.
  * `options` Object - options.

Example

    var bodyParser = require('stream-body-parser');
    
    var bodyParser = new StreamBodyParser({ uploadDir: './public' }, anExpressApp)
    
Prepares a new StreamBodyParser and - optionally if the app parameter is supplied, configures it for use with connect.js or express.js.

### streamBodyParser.process(mime, fn)

  * `mime` String - Mime type to process with fn. As an example: `image/jpeg` or `video/*`. **Default** value `*/*`
  * `fn` Function - Processor function for when file of specified mime type is about to be uploaded.
    * `fn` should be a function accepting three parameters.
      * `stream` Object - The stream of the file being uploaded.
      * `req` Object - The req object of connect.js/express.js
      * `next` Function - Function to be called, when processor is done processing all the data.

If `uploadDir` is specified by options doing object creation, a processor will be registered to mime type `*/*` that simply pipes the input to a files in the specified directory.

    var express = require('express'),
        StreamBodyParser = require('stream-body-parser'),
        Transcoder = require('stream-transcoder');
    
    var app = express();
    
    var bodyParser = new StreamBodyParser(app);
    
    bodyParser.process('image/jpeg', function(stream, req, next) {
    	
    	stream.pipe(fs.createFileStream(stream.filename));
    	stream.on('end', next);
    	
    });
    
    bodyParser.process(function(stream, req, next) {
    	console.log('Stream of type ' + stream.mime + ' is being uploaded.');
    	stream.on('end', function() {
    		console.log('Done');
    		next();
    	});
    });
    
The above example simply images of type jpeg to a filename named the same as the incoming file.

The second is processor simply logs that a file is being uploaded, and when it completes.

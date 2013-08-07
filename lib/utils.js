module.exports = utils = {};

if (!Buffer.prototype.indexOf) {
	Buffer.prototype.indexOf = function(needle, offset, length) {
		offset = offset || 0;
		length = length || this.length;
		var h,n;
		for (h = offset ; h < length + offset ; h++) {
			for (n = 0 ; n < needle.length ; n++) {
				if (this[h + n] != needle[n]) break;
			}
			if (n == needle.length) return h - offset;
			h += n;
		}
		return -1;
	}
};

utils.mime = function(headers) {
	
	contentType = headers['content-type'] || '';	
	return contentType.split(/; ?/)[0];
	
};

utils.values = function(header) {
	
	var r = {};
	header = header || '';	
	
	header.split(/; ?/).forEach(function(kv) {
		var v = kv.split('=');
		if (v[1] && v[1].substr(-1) == '"') v[1] = v[1].substr(1, v[1].length - 2);
		r[v[0]] = v[1];
	});
	
	return r;
	
};

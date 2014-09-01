/*jshint laxbreak:true*/
"use strict";
var fs = require('fs')
	, D = require('d.js')
	, methods = (
		'rename,ftruncate,truncate,chown,fchown,lchown,chmod,fchmod,lchmod,stat,lstat,fstat,link,symlink,readlink,realpath'
		+ ',unlink,rmdir,mkdir,readdir,close,open,utimes,futimes,fsync,write,read,readFile,writeFile,appendFile'
	).split(',')
;
methods.forEach(function(m){
	fs[m + 'Promise'] = D.nodeCapsule(fs, fs[m]);
});

fs.readJsonSync = function readJsonSync(filename, options){
	if( options && !options.encoding ){
		options.encoding='utf8';
	}
	var data = fs.readFileSync(filename, options || 'utf8');
	return JSON.parse(data);
};
fs.readJsonPromise = function readJsonPromise(filename, options){
	return fs.readFilePromise(filename, options).success(JSON.parse);
};

function stringify(data, options){
	var replacer = options && options.replacer || null
		, space = options && options.space || '\t'
	;
	return JSON.stringify(data, replacer, space);
}
fs.writeJsonSync = function writeJsonSync(filename, data, options){
	if( options && !options.encoding ){
		options.encoding='utf8';
	}
	return fs.writeFileSync(filename, stringify(data, options), options || 'utf8');
};
fs.writeJsonPromise = function writeJsonPromise(filename, data, options){
	return fs.writeFilePromise(filename, stringify(data, options), options);
};

/**
* workaround duplicates watch events. options can take a ttl property to modify the default 100ms of ttl for last event.
*/
fs.watchDeduped = function(filename, options, listener){
	if ((! listener) && options instanceof Function) {
		listener = options;
		options = undefined;
	}
	var ttl = options && options.ttl || 100
		 , lasttimes = {}
	;
	return fs.watch(filename, options ||  {}, function(eventName, fileName){
		var now = (new Date()).getTime()
			, lasttime = lasttimes[eventName + ':' + fileName] || 0
		;
		if( now < (lasttime + ttl) ){
			return;
		}
		lasttimes[eventName + ':' + fileName] = now;
		listener(eventName, fileName);
	})

}

module.exports = fs;

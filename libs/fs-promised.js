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
fs.writeJsonSync = function writeJsonSync(filename, data, options){
	data = JSON.stringify(data, options && options.space || '\t');
	if( options && !options.encoding ){
		options.encoding='utf8';
	}
	return fs.writeFileSync(filename, data, options || 'utf8');
};
fs.writeJsonPromise = function writeJsonPromise(filename, data, options){
	return fs.writeFilePromise(filename, JSON.stringify(data), options);
};

module.exports = fs;

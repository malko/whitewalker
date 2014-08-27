var fs = require('fs')
	, D = require('d.js')
	, methods = (
		'rename,ftruncate,truncate,chown,fchown,lchown,chmod,fchmod,lchmod,stat,lstat,fstat,link,symlink,readlink,realpath'
		+ ',unlink,rmdir,mkdir,readdir,close,open,utimes,futimes,fsync,write,read,readFile,writeFile,appendFile'
	).split(',')
;
methods.forEach(function(m){
	fs[m + 'promise'] = D.nodeCapsule(fs, fs[m]);
});

fs.readJsonPromise = function readJsonPromise(filename, options){
	return fs.readFilePromise(filename, options).success(JSON.parse);
}

fs.writeJsonPromise = function writeJsonPromise(filename, data, options){
	return fs.writeFilePromise(filename, JSON.stringify(data), options);
}

module.exports = fs;

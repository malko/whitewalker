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

fs.readJsonSync = function readJsonSync(filename, options, callback){
	return fs.readFileSync(filename, options, function(err, data){
		if( !err ){
			try{
				data = JSON.parse(data);
			}catch(e){
				return callback(e);
			}
			callback(err,data);
		}
		callback(err, data);
	});
};
fs.readJsonPromise = function readJsonPromise(filename, options){
	return fs.readFilePromise(filename, options).success(JSON.parse);
};
fs.writeJsonSync = function writeJsonSync(filename, data, options, callback){
	try{
		data = JSON.stringify(data);
	}catch(e){
		callback(e);
		return;
	}
	return fs.writeFileSync(filename, data, options, callback);
};
fs.writeJsonPromise = function writeJsonPromise(filename, data, options){
	return fs.writeFilePromise(filename, JSON.stringify(data), options);
};

module.exports = fs;

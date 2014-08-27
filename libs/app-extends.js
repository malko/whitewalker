module.exports.extend = function(app){
	app.on = function (path, middleware){
		this.use(function(req, res, next){
			var params = req.originalUrl.match('^' + path + '$');
			if(! params){
				return next();
			}
			params = [].slice.call(arguments).concat(params.slice(1));
			middleware.apply(null, params);
		});
		return this;
	};
	return app;
};

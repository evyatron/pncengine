var Objects = new function() {
	var _this = this,
		objects = {};
	
	this.init = function init(options) {
		objects = options.objects;
	};
	
	this.getDataByType = function getDataByType(type) {
		return objects[type] || {};
	};
};
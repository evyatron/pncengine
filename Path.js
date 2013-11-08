function Path(_options) {
	var _this = this,
		areas = null,
		pointA = null, areaA = null,
		pointB = null, areaB = null,
		points = [];
		
	this.init = function init(_options) {
		areas = _options.areas && JSON.parse(JSON.stringify(_options.areas));
		pointA = _options.pointA.slice(0);
		pointB = _options.pointB.slice(0);
		
        if (areas) {
            areaA = Utils.getPointArea(areas, pointA);
            areaB = Utils.getPointArea(areas, pointB);
		}
        
		// first we add the origin point (point A)
		_this.addPoint(pointA);
        
        // then we add all the connections between areas
        if (areas) {
            addConnectingPoints();
        }
        
		// lastly the destination point (point B)
		_this.addPoint(pointB);
	};
	
	// add a new point in the path (unless it's already in it)
	this.addPoint = function addPoint(point) {
		if (points.indexOf(point) !== -1) return;
		
		points.push(point);
	};
	
	// return all the points on the path
	this.getPoints = function getPoints() {
		return points;
	};
	
	// get the distance of the entire path, from point A to B
	this.getDistance = function getDistance(_points) {
		!_points && (_points = points);
		var distance = 0;
		
		for (var i=1; i<points.length; i++) {
			distance += Utils.distance(points[i-1], points[i]);
		}
		
		return distance;
	};
	
	// get the path origin- point and area
	this.getOrigin = function getOrigin() {
		return {
			"point": pointA,
			"area": areaA
		};
	};
	
	// get the path destination- point and area
	this.getDestination = function getDestination() {
		return {
			"point": pointB,
			"area": areaB
		};
	};
	
	// how to get from area A to area B
	function addConnectingPoints() {
		// if point A and point B are in the same area- no need for connections
		if (areaA === areaB) return;
		
		// if there's a direct connection between point A and point B
		var connectionPoint = (areas[areaA].inters || {})[areaB];
		if (connectionPoint) {
			_this.addPoint(connectionPoint);
			return;
		}
		
		// points not in the same area and don't have a direct connection- need to find the correct path
		var path = [];
		getPointsBetweenArea(areas, areaA, areaB, path, {});
		
		// add the area-connecting points to the path
		points = points.concat(path);
	}
	
	// get points connecting areaFrom to areaTo (RECURSIE!)
	function getPointsBetweenArea(areas, areaFrom, areaTo, path, checked) {
		if (checked[areaFrom + '_' + areaTo]) return false;
		checked[areaFrom + '_' + areaTo] = true;
		
		// always sort the connecting points according to the last point on the path
		areas = sortByDistance(areas, areaTo, points[points.length - 1]);
		
		var inters = areas[areaTo].inters;
		if (inters[areaFrom]) {
			return inters[areaFrom];
		}
		
		for (var areaId in inters) {
			var connectingPoint = getPointsBetweenArea(areas, areaFrom, areaId, path, checked);
			if (connectingPoint) {
				_this.addPoint(connectingPoint);
				_this.addPoint(inters[areaId]);
				return inters[areaId];
			}
		}
		
		return false;
	}
	
	// sort the connecting areas by distance from origin point
	function sortByDistance(_areas, area, point) {
		var localAreas = JSON.parse(JSON.stringify(_areas)),
			areaConnections = localAreas[area].inters, sortable = [];
			
		for (var areaId in areaConnections) {
			sortable.push({
				"areaId": areaId,
				"point": areaConnections[areaId],
				"distance": Utils.distance(point, areaConnections[areaId])
			});
		}
		
		sortable.sort(arraySortByDistance);
		
		localAreas[area].inters = {};
		for (var i=0; i<sortable.length; i++) {
			localAreas[area].inters[sortable[i].areaId] = sortable[i].point;
		}
		
		return localAreas;
	}
	
	function arraySortByDistance(a, b) {
		return a.distance > b.distance? 1 : a.distance < b.distance? -1 : 0;
	}
		
	_this.init(_options);
}
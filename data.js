// Requires Express.js

var crossfilter = require("./crossfilter.v1.min.js").crossfilter;
var fs = require('fs');
var d3 = require('d3');

//console.log(visual_attributes)
// Read the CSV file into flights
var dataraw = fs.readFileSync("d.json");
//var dataraw = fs.readFileSync("250_data.json")
data = JSON.parse(dataraw);



var dateFormat = d3.time.format("%m/%d/%Y");
var numberFormat = d3.format(".2f");

data.forEach(function (d) {
    d["dd"] = dateFormat.parse(d.date);
    d["month"] = d3.time.month(d.dd); // pre-calculate month for better performance
    d["close"] = +d.close; // coerce to number
    d["open"] = +d.open;
    d["profitOrLoss"] = function(){    	
    	return d.open > d.close ? "Loss" : "Gain";
    }();
    d["quarter"] = function () {
    	var month = d.dd.getMonth();
	    if (month <= 2)
	        return "Q1";
	    else if (month > 3 && month <= 5)
	        return "Q2";
	    else if (month > 5 && month <= 8)
	        return "Q3";
	    else
	        return "Q4";
    }();
    d["dayOfWeek"] = function(){
	    var day = d.dd.getDay();
	    var name=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
	    return name[day];

    }();
    d["yearly"] = function(){
		return d3.time.year(d.dd).getFullYear();    	
    }();
    d["fluctuation"] = function () {
    	return Math.round((d.close - d.open)/d.open *100);
    }();
});

//### Create Crossfilter Dimensions and Groups
//See the [crossfilter API](https://github.com/square/crossfilter/wiki/API-Reference) for reference.
var ndx = crossfilter(data);
var all = ndx.groupAll();

// dimension by year
var yearlyDimension = ndx.dimension(function (d) {
    return d3.time.year(d.dd).getFullYear();
});
// maintain running tallies by year as filters are applied or removed
var yearlyPerformanceGroup = yearlyDimension.group().reduce(
    /* callback for when data is added to the current filter results */
    function (p, v) {
        ++p.count;
        p.absGain += v.close - v.open;
        p.fluctuation += Math.abs(v.close - v.open);
        p.sumIndex += (v.open + v.close) / 2;
        p.avgIndex = p.sumIndex / p.count;
        p.percentageGain = (p.absGain / p.avgIndex) * 100;
        p.fluctuationPercentage = (p.fluctuation / p.avgIndex) * 100;
        return p;
    },
    /* callback for when data is removed from the current filter results */
    function (p, v) {
        --p.count;
        p.absGain -= v.close - v.open;
        p.fluctuation -= Math.abs(v.close - v.open);
        p.sumIndex -= (v.open + v.close) / 2;
        p.avgIndex = p.sumIndex / p.count;
        p.percentageGain = (p.absGain / p.avgIndex) * 100;
        p.fluctuationPercentage = (p.fluctuation / p.avgIndex) * 100;
        return p;
    },
    /* initialize p */
    function () {
        return {count: 0, absGain: 0, fluctuation: 0, fluctuationPercentage: 0, sumIndex: 0, avgIndex: 0, percentageGain: 0};
    }
);

// dimension by full date
var dateDimension = ndx.dimension(function (d) {
    return d.dd;
});

// dimension by month
var moveMonths = ndx.dimension(function (d) {
    return d.month;
});
// group by total movement within month
var monthlyMoveGroup = moveMonths.group().reduceSum(function (d) {
    return Math.abs(d.close - d.open);
});
// group by total volume within move, and scale down result
var volumeByMonthGroup = moveMonths.group().reduceSum(function (d) {
    return d.volume / 500000;
});
var indexAvgByMonthGroup = moveMonths.group().reduce(
    function (p, v) {
        ++p.days;
        p.total += (v.open + v.close) / 2;
        p.avg = Math.round(p.total / p.days);
        return p;
    },
    function (p, v) {
        --p.days;
        p.total -= (v.open + v.close) / 2;
        p.avg = p.days ? Math.round(p.total / p.days) : 0;
        return p;
    },
    function () {
        return {days: 0, total: 0, avg: 0};
    }
);

// create categorical dimension
var gainOrLoss = ndx.dimension(function (d) {
    return d.open > d.close ? "Loss" : "Gain";
});
// produce counts records in the dimension
var gainOrLossGroup = gainOrLoss.group();

// determine a histogram of percent changes
var fluctuation = ndx.dimension(function (d) {
    return Math.round((d.close - d.open) / d.open * 100);
});
var fluctuationGroup = fluctuation.group();

// summerize volume by quarter
var quarter = ndx.dimension(function (d) {
    var month = d.dd.getMonth();
    if (month <= 2)
        return "Q1";
    else if (month > 3 && month <= 5)
        return "Q2";
    else if (month > 5 && month <= 8)
        return "Q3";
    else
        return "Q4";
});
var quarterGroup = quarter.group().reduceSum(function (d) {
    return d.volume;
});


// counts per weekday
var dayOfWeek = ndx.dimension(function (d) {
    var day = d.dd.getDay();
    var name=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return day+"."+name[day];
 });
var dayOfWeekGroup = dayOfWeek.group();

console.log(JSON.stringify(gainOrLoss.top(Infinity), null, 4))
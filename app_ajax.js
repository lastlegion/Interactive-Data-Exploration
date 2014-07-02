// Requires Express.js

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var crossfilter = require("./crossfilter.js").crossfilter;
var fs = require('fs');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));



var visual_attributes = [];
var filtering_attributes = [];

//Read the schema
var schema = fs.readFileSync("public/backend-schema.json");
schema = JSON.parse(schema);
//console.log(schema)
for(var attribute in schema){
	console.log(attribute)
	if(schema[attribute]["visual-attribute"])
		visual_attributes.push(schema[attribute]);
  if(schema[attribute]["filtering-attribute"])
    filtering_attributes.push(schema[attribute]);
}
//console.log(visual_attributes)
// Read the CSV file into flights
var dataraw = fs.readFileSync("dcData.json");
//var dataraw = fs.readFileSync("250_data.json")
data = JSON.parse(dataraw)
var dimensions = {};
var groups = {};
var ndx = crossfilter(data);
for(var attr in filtering_attributes){
    if(filtering_attributes[attr]["datatype"] == "integer")
    dimension = ndx.dimension(function(d){return 1*d[filtering_attributes[attr]["name"]]});
  else
    dimension = ndx.dimension(function(d){return d[filtering_attributes[attr]["name"]]});

  if(filtering_attributes[attr]["dimension"])
    dimension = ndx.dimension(filtering_attributes[attr]["dimensions"]())

  dimensions[filtering_attributes[attr]["name"]] = dimension;
  var bin_factor = filtering_attributes[attr]["bin-factor"];
  if(bin_factor){
    group = dimension.group(function(d){
      return Math.floor(d/(bin_factor))*(bin_factor);
    });
  } else {
    group = dimension.group();
  }
  groups[filtering_attributes[attr]["name"]] = group;
}

dimensions["yearly"] = ndx.dimension(function(d){
  return d.yearly;
})

groups["yearly"] = dimensions["yearly"].group().reduce(
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

size = ndx.size(),
all = ndx.groupAll();
console.log(filtering_attributes)
// Handle the AJAX requests
app.use("/data",function(req,res,next) {
  
  console.log("Getting /data")
  filter = req.param("filter") ? JSON.parse(req.param("filter")) : {}
  // Loop through each dimension and check if user requested a filter

  // Assemble group results and and the maximum value for each group
  var results = {} 
  var filter_dim;
  var filter_range=[];
  //console.log(filter[dim])
  for(var key in filter){
    filter_dim= key;
  }
  
  Object.keys(dimensions).forEach(function (dim) {

    if (filter[dim]) {
      console.log(filter[dim])
    
      //If enumerated
      if(filter[dim].length > 1){
        if(typeof filter[dim][0] == "string"){
          
          console.log(dimensions[dim]);
          /*
          function ff(dim){
            return function(d)
            {
              for(var i=0; i<filter[dim].length; i++){
                var f = filter[dim][i];
                if(f == d)
                  return true;
              }
              return false;
            }
          };
          dimensions[dim].filterFunction(ff(dim));
          */
          
          dimensions[dim].filterFunction(
          function(d){
            for(var i=0; i<filter[dim].length; i++){
              var f = filter[dim][i];
              if(f == d ){
                return true;
              }
            }
            return false;  
          });
        
        } else {
          dimensions[dim].filter(filter[dim])
        }
      }
      else{
        dimensions[dim].filter(filter[dim][0])
      }
    } else {
      dimensions[dim].filterAll(null)
    }
  })
  
  if(Object.keys(filter).length === 0){
      //dimensions["Ai"].filter(null)
      results["table_data"] = {data:dimensions[filtering_attributes[0]["name"]].top(100)}
  }
  else{
      //dimensions[filter_dim].filterRange(filter_range)
      results["table_data"] = {data:dimensions[filter_dim].top(100)}
  }
  Object.keys(groups).forEach(function(key) {
      results[key] = {values:groups[key].all(),top:groups[key].top(1)[0].value}
  })
  //console.log(results)
  //console.log(dimensions["age"].top(100))  
  // Send back as json
  //console.log(results)
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end((JSON.stringify(results)))
})

// Change this to the static directory of the index.html file
app.get('/', routes.index);
app.get('/index2.html', routes.index2)
app.get('/index3.html', routes.index3)
app.get('/index4.html', routes.index4)
app.get('/test.html', routes.test)
app.get('/users', user.list);

var port = 5000;
app.listen(port,function() {
  console.log("listening to port "+port)  
})

var AssignDefault = function(x, dv) {
  return(typeof x !== 'undefined' ? x : dv);
};

// here is the modified rwc function, see the example below for usage
exports.rwGenSR_waterMask = function(MAXDISTANCE, FILL_SIZE, MAXDISTANCE_BRANCH_REMOVAL, AOI) {
   
  // assign default values
  // WATER_METHOD = AssignDefault(WATER_METHOD, 'Jones2019');
  MAXDISTANCE = AssignDefault(MAXDISTANCE, 4000);
  FILL_SIZE = AssignDefault(FILL_SIZE, 333);
  MAXDISTANCE_BRANCH_REMOVAL = AssignDefault(MAXDISTANCE_BRANCH_REMOVAL, 500);
  AOI = AssignDefault(AOI, null);
  
  
  var grwl = ee.FeatureCollection("users/eeProject/grwl");
  var lsFun = require('users/eeProject/RivWidthCloudPaper:functions_Landsat578/functions_landsat.js');
  var riverFun = require('users/eeProject/RivWidthCloudPaper:functions_river.js');
  var clWidthFun = require('users/eeProject/RivWidthCloudPaper:functions_centerline_width.js');
  
  exports.CalculateWidth_waterMask = function(imgIn) {
    var crs = imgIn.get('crs');
    var scale = imgIn.get('scale');
    var imgId = imgIn.get('image_id');
    var bound = imgIn.select('riverMask').geometry();
    var angle = imgIn.select('orthDegree');
    var dem = ee.Image("users/eeProject/MERIT");
    var infoEnds = imgIn.select('riverMask');
    var infoExport = imgIn.select('channelMask')
    // .addBands(imgIn.select('^flag.*'))
    .addBands(dem.rename('flag_elevation'));
    var dm = imgIn.select('distanceMap');
    
    var widths = clWidthFun.GetWidth(angle, infoExport, infoEnds, dm, crs, bound, scale, imgId)
    .map(clWidthFun.prepExport);
    return(widths);
  };
  
  // generate function based on user choice
  var tempFUN = function(img) {
    
    AOI = ee.Algorithms.If(AOI, AOI, img.geometry());
    img = img.clip(AOI);
    
    // derive water mask and masks for flags
    // var imgOut = lsFun.CalculateWaterAddFlagsSR(image, WATER_METHOD);
    // calculate river mask
    var imgOut = riverFun.ExtractRiver(img, grwl, MAXDISTANCE, FILL_SIZE);
    // calculate centerline
    imgOut = clWidthFun.CalculateCenterline(imgOut);
    // calculate orthogonal direction of the centerline
    imgOut = clWidthFun.CalculateOrthAngle(imgOut);
    // export widths
    var widthOut = exports.CalculateWidth_waterMask(imgOut);
    
    return(widthOut);
  };
  
  return(tempFUN);
};


// EXAMPLE //

// Goal: calculate river centerlines and widths for a given water mask
// for convinience here water mask was generated from Landsat image (LC08_L1TP_022034_20130422_20170310_01_T1)
// but it can be any user-defined water mask: binary image assuming water = 1 and nonwater = 0, that
// has three essential properties ['crs', 'scale', 'image_id'].

// generate the watermask
// this water mask can be replaced by any user-defined water mask, as long as
// it has three essential properties ['crs', 'scale', 'image_id']
var imageId = "LC08_L1TP_022034_20130422_20170310_01_T1";
var fns = require('users/eeProject/RivWidthCloudPaper:functions_Landsat578/functions_landsat.js');
var img = fns.id2Img(imageId);
var waterMask = fns.ClassifyWater(img, 'Jones2019').select('waterMask');
waterMask = ee.Image(waterMask.setMulti({
  crs: img.projection().crs(),
  scale: 30,
  image_id: img.get('LANDSAT_ID')
})).aside(print, 'example input watermask');

Map.addLayer(img);

// initiate and apply the rivwidthcloud function
var rwc = exports.rwGenSR_waterMask(4000, 333, 500);
var widths = rwc(waterMask);

// examine the first record
print(widths.first(), 'Example output');

// // remove the geometry before exporting the width as CSV file
widths = widths.map(function(f) {return(f.setGeometry(null))});

// export the result as a CSV file into Google drive
Export.table.toDrive({
  collection: widths,
  description: imageId,
  folder: 'riverWidth',
  fileNamePrefix: imageId,
  fileFormat: "CSV"});

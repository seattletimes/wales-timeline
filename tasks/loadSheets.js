/*

Uses the Google Sheets API to pull data from Sheets and load it onto shared
state. Writes the data out to JSON for later reference. Does not currently
check for existing data to merge--it does a fresh pull every time.

Sheets must be both A) shared publicly and B) "published to web" before they
can be accessed by this task.

*/

// var project = require("../project.json");
// var async = require("async");
// var sheets = require("google-spreadsheets");
//
// var camelCase = function(str) {
//   return str.replace(/[^\w]+(\w)/g, function(all, match) {
//     return match.toUpperCase();
//   });
// };
//
// var cast = function(str) {
//   if (typeof str !== "string") {
//     if (typeof str.value == "string") {
//       str = str.value;
//     } else {
//       return str;
//     }
//   }
//   if (str.match(/^[\d\.,]+$/)) {
//     //number
//     return Number(str.replace(/,/g, ""));
//   }
//   if (str.toLowerCase() == "true" || str.toLowerCase() == "false") {
//     return str.toLowerCase() == "true" ? true : false;
//   }
//   return str;
// };
//
// module.exports = function(grunt) {
//
//   grunt.registerTask("sheets", "Downloads from Google Sheets -> JSON", function() {
//
//     var auth = {};
//     try {
//       auth = require("../auth.json");
//     } catch (_) { /* no auth.json, that's fine */ }
//     var sheetKeys = project.sheets || (auth.google && auth.google.sheets);
//
//     if (!sheetKeys || !sheetKeys.length) {
//       return grunt.fail.fatal("You must specify a spreadsheet key in project.json or auth.json!");
//     }
//
//     var done = this.async();
//
//     async.each(sheetKeys, function(key, bookDone) {
//       sheets({
//         key: key
//       }, function(err, book) {
//         if (err || !book) {
//           grunt.fail.warn("Unable to access book for " + key + ", is it 'published' in Sheets?");
//           return bookDone();
//         }
//         //download each worksheet
//         async.each(book.worksheets, function(page, pageDone) {
//           sheets.cells({ key: key, worksheet: page.id }, function(err, cells) {
//             if (err) {
//               grunt.fail.warn("Couldn't load sheet " + page.id + " for " + book.title);
//               return pageDone();
//             }
//             cells = cells.cells;
//
//             //get the header row
//             var rowNumbers = Object.keys(cells);
//             var headerNumber = rowNumbers.shift();
//             var headers = cells[headerNumber];
//             var isKeyed = false;
//             for (var cell in headers) {
//               headers[cell] = headers[cell].value;
//               if (headers[cell] == "key") {
//                 isKeyed = true;
//               }
//             }
//
//             var output = isKeyed ? {} : [];
//
//             //create the rows
//             rowNumbers.forEach(function(rowNum) {
//               var line = cells[rowNum];
//               var columnNumbers = Object.keys(line);
//               var row = {};
//               columnNumbers.forEach(function(colNum) {
//                 var value = line[colNum];
//                 var key = headers[colNum];
//                 row[key] = cast(value);
//               });
//               if (isKeyed) {
//                 output[row.key] = row;
//                 delete row.key;
//               } else {
//                 output.push(row);
//               }
//             });
//
//             var filename = "data/" + camelCase(page.title) + ".sheet.json";
//             grunt.file.write(filename, JSON.stringify(output, null, 2));
//             pageDone();
//           });
//         }, bookDone);
//       });
//     }, done);
//
//   });
//
// };

var project = require("../project.json");
var async = require("async");
var os = require("os");
var path = require("path");
var { google } = require("googleapis");
var api = google.sheets("v4");

var { authenticate } = require("./googleauth");

var camelCase = function(str) {
  return str.replace(/[^\w]+(\w)/g, function(all, match) {
    return match.toUpperCase();
  });
};

var cast = function(str) {
  if (typeof str !== "string") {
    if (typeof str.value == "string") {
      str = str.value;
    } else {
      return str;
    }
  }
  if (str.match(/^-?(0?\.|[1-9])[\d\.]*$/) || str == "0") {
    var n = Number(str);
    if (isNaN(n)) return str;
    return n;
  }
  if (str.toLowerCase() == "true" || str.toLowerCase() == "false") {
    return str.toLowerCase() == "true" ? true : false;
  }
  return str;
};

module.exports = function(grunt) {

  grunt.registerTask("sheets", "Downloads from Google Sheets -> JSON", async function() {

    var auth = null;
    try {
      auth = authenticate();
    } catch (err) {
      console.log("No access token from ~/.google_oauth_token, private spreadsheets will be unavailable.", err)
    };

    var sheetKeys = project.sheets;

    if (!sheetKeys || !sheetKeys.length) {
      return grunt.fail.fatal("You must specify a spreadsheet key in project.json or auth.json!");
    }

    var done = this.async();

    for (var spreadsheetId of sheetKeys) {
      var book = (await api.spreadsheets.get({ auth, spreadsheetId })).data;
      var { sheets, spreadsheetId } = book;
      for (var sheet of sheets) {
        if (sheet.properties.title[0] == "_") continue;
        var response = await api.spreadsheets.values.get({
          auth,
          spreadsheetId,
          range: `${sheet.properties.title}!A:AAA`,
          majorDimension: "ROWS"
        });
        var { values } = response.data;
        var header = values.shift();
        var isKeyed = header.indexOf("key") > -1;
        var isValued = header.indexOf("value") > -1;
        var out = isKeyed ? {} : [];
        for (var row of values) {
          // skip blank rows
          if (!row.length) continue;
          var obj = {};
          row.forEach(function(value, i) {
            var key = header[i];
            obj[key] = cast(value);
          });
          if (isKeyed) {
            out[obj.key] = isValued ? obj.value : obj;
          } else {
            out.push(obj);
          }
        }
        var filename = `data/${sheet.properties.title.replace(/\s+/g, "_")}.sheet.json`;
        console.log(`Saving sheet to ${filename}`);
        grunt.file.write(filename, JSON.stringify(out, null, 2));
      }
    }

    done();

  });

};

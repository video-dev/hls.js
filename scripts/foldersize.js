#!/usr/bin/env node

const fs = require("fs"),
      path = require("path");

var folderName = process.argv[2];

fs.readdir(folderName, function (err, files) {
    if (err) {
        throw err;
    }
    files.map(function (file) {
        return path.join(folderName, file);
    }).filter(function (file) {
        return fs.statSync(file).isFile();
    }).forEach(function (file) {
        console.log("%s (%s)", file, fs.statSync(file).size);
    });
});

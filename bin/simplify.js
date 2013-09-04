#!/usr/bin/env node

var fs = require("fs");
var path = require("path");
var optimist = require("optimist");
var simplify = require("simplify-geometry");

var argv = optimist.argv;

var FILE_IN = path.resolve(argv._[0]);
var FILE_OUT = path.resolve(argv._[1]);

var paths = JSON.parse(fs.readFileSync(FILE_IN));

for (k in paths) {
	paths[k] = simplify(paths[k],0.0001);
}

fs.writeFileSync(FILE_OUT, JSON.stringify(paths,null,'\t'));


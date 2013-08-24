/*jslint node: true*/
"use strict";

//Admin liides
exports.index = function (req, res) {
    res.render('admin', {title: 'Admin'});
};

exports.page = function (req, res) {
    var page = req.params.page;
    res.render('admin/' + page);
};

exports.dialog = function (req, res) {
    var dialog = req.params.dialog;
    res.render('dialog/' + dialog);
};
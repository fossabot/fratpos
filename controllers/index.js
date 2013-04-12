var transactions = require('../models/transactions');
var products = require('../models/products');
var users = require('../models/users');
var paytypes = require('../models/paytypes');
var async = require('async');
//Kassa
exports.index = function(req, res){
    res.render('index', { title: 'Kassa'});
};

exports.invalid = function(req, res){
    transactions.invalid(req.body.id, function(err){
        res.send({status: err == null ? 'success' : err});
    });
}

exports.posdata = function(req, res){
    async.parallel({
            transactions: async.apply(transactions.getWithFilter,{hidden: false, invalid: false}),
            products: async.apply(products.getAll),
            paytypes: async.apply(paytypes.getAll),
            users: async.apply(users.getAll)
        }
        ,function(err, result){
            var addName = function(user, callback){
                user.label = users.getUserFullName(user);
                callback(null, user);
            }
            async.map(result.users, addName, function(err, users){
                res.send({transactions: result.transactions, products: result.products, paytypes: result.paytypes, users: users});
            });
        });
};

exports.transaction = function(req, res){
    async.series({
        allowed: async.apply(isPaymentTypeAllowed, req),
        transactionId: async.apply(createTransaction, req)
    },
    function(err, result){
        if(err){
            res.send({status: err});
        }
        else if(!result.allowed) {
            res.send({status: "invalid_paytype"});
        }
        else if(!result.transactionId){
            res.send({status: "creation_failed"});
        }
        else{
            console.log(result.transactionId);
            transactions.get(String(result.transactionId), function(err, transaction){
                res.send({status: (err == null ? "success" : err), transaction: transaction});
            });
        }
    });
}

var isPaymentTypeAllowed = function(req, callback){
    async.parallel({
        user: async.apply(users.get, req.body.user),
        paytypes: async.apply(paytypes.getAll)
    },
    function(err, result){
        if(err){
            callback(err, false);
        }
        else {
            for(i=0;i<result.paytypes.length;i++){
                var paytype = result.paytypes[i];
                if(paytype.name == req.body.type){
                    callback(null, paytype.allowedForStatus.indexOf(result.user.status) != -1);
                    break;
                }
            }
        }
    });
}

var createTransaction = function(req, callback){
    var products = [];
    for(id in req.body.products)
        products.push(req.body.products[id]);
    var transaction = {
        time: new Date(),
        user: req.body.user,
        products: products,
        type: req.body.type,
        invalid: false,
        hidden: false
    }
    transactions.save(transaction, function(err, sum, id){
        var end = function(err){
            callback(err, id);
        }
        err == null ? decrementProductsAndBalance(transaction, end) : end(err);
    });
}

var decrementProductsAndBalance = function(transaction, callback){
    var decrement = function(product, callback){
        products.incQuantity(product.name, -product.quantity, callback);
    }
    async.each(transaction.products, decrement, function(err){
        paytypes.get(transaction.type, function(err, paytype){
            if(paytype && paytype.affectsBalance == true){
                var sum = transactions.getTransactionSum(transaction);
                users.incrementBalance(transaction.user, -sum, callback);
            }
            else {
                callback(err);
            }
        });
    });
}
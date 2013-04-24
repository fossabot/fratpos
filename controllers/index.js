var transactions = require('../models/transactions');
var products = require('../models/products');
var users = require('../models/users');
var paytypes = require('../models/paytypes');
var async = require('async');
var nconf = require('../lib/nconf');

//Kassa
exports.index = function(req, res){
    res.render('index', { title: 'Kassa', manifest: 'app.cache'});
};

exports.invalidAdmin = function(req, res){
    var password = nconf.get('admin:password');
    invalidateTransaction(req.body.id, password, res);
}

exports.invalid = function(req, res){
    invalidateTransaction(req.body.id, req.body.password, res);
}

var invalidateTransaction = function(id, password, res){
    var isTimedOut = function(transaction){
        var timeout = nconf.get('timeout') * 1000;
        var time = transaction.time.getTime();
        var current = new Date().getTime();
        return current-time > timeout;
    }
    transactions.get(id, function(err, transaction){
        if(isTimedOut(transaction)){
            if(password !== nconf.get('admin:password')){
                res.send({status: "Transaction has timed out!"});
                return;
            }
        }
        transactions.invalid(id, function(err){
            res.send({status: err == null ? 'success' : err});
        });
    });
}

exports.posdata = function(req, res){
    async.parallel({
            transactions: async.apply(transactions.getWithFilter,{invalid: false}),
            products: async.apply(products.getAll),
            paytypes: async.apply(paytypes.getAll),
            users: async.apply(users.getAll)
        }
        ,function(err, result){
            res.send({transactions: result.transactions, products: result.products, paytypes: result.paytypes, users: result.users});
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
            res.send({status: 'invalid_paytype'});
        }
        else if(!result.transactionId){
            res.send({status: 'creation_failed'});
        }
        else{
            transactions.get(String(result.transactionId), function(err, transaction){
                res.send({status: (err == null ? 'success' : err), transaction: transaction});
            });
        }
    });
}

var isPaymentTypeAllowed = function(req, callback){
    paytypes.getAll(function(err, paytypes){
        if(err){
            callback(err, false);
        }
        else {
            for(i=0;i<paytypes.length;i++){
                var paytype = paytypes[i];
                if(paytype.name == req.body.type){
                    callback(null, paytype.allowedForStatus.indexOf(req.body.user.status) != -1);
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
        invalid: false
    }
    transactions.save(transaction, function(err, sum, id){
        var end = function(err){
            callback(err, id);
        }
        err == null ? decrementProductsAndBalance(transaction, end) : end(err);
    });
}

var decrementProductsAndBalance = function(transaction, callback){
    paytypes.get(transaction.type, function(err, paytype){
        if(err){callback(err);return;}
        var decrement = function(product, callback){
            if(paytype.affectsQuantity){
                var quantity = -product.quantity;
                if(paytype.credit)
                    quantity = -quantity;
                products.incQuantity(product.name, quantity, callback);
                return;
            }
            callback();
        }
        async.each(transaction.products, decrement, function(err){
            if(paytype && paytype.affectsBalance == true){
                var sum = -transactions.getTransactionSum(transaction);
                if(paytype.credit)
                    sum = -sum;
                users.incrementBalance(transaction.user._id, sum, callback);
            }
            else {
                callback(err);
            }
        });
    });
}
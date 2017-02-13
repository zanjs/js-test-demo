"use strict";
var Promise = require("bluebird");
var Flow = (function () {
    function Flow(tasks) {
        if (tasks === void 0) { tasks = []; }
        this.tasks = tasks;
        this.parent = null;
        if (!(this instanceof Flow)) {
            return new Flow(tasks);
        }
    }
    Flow.prototype.append = function () {
        var tasks = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            tasks[_i] = arguments[_i];
        }
        this.tasks = this.tasks.concat(tasks);
        return this;
    };
    Flow.prototype.prepend = function () {
        var tasks = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            tasks[_i] = arguments[_i];
        }
        this.tasks = tasks.concat(this.tasks);
        return this;
    };
    Flow.prototype.exec = function (task, last) {
        var _this = this;
        this.lastValue = last;
        // executor of a single task
        var single = function (t) {
            if (t instanceof Flow) {
                // the task is a flow instance as a child flow
                // specify the child flow's parent to this
                t.parent = _this;
                // start the child flow
                return t.start(last);
            }
            else {
                // the task is a function
                // exec the function
                return t.call(_this, last);
            }
        };
        if (Array.isArray(task)) {
            // task is an array 
            // exec each task concurrently
            return Promise.map(task, function (it) {
                return single(it);
            });
        }
        else {
            return single(task);
        }
    };
    Flow.prototype.start = function (initValue) {
        var _this = this;
        if (initValue === void 0) { initValue = Promise.resolve(); }
        return Promise.reduce(this.tasks, function (last, curr) {
            return _this.exec(curr, last);
        }, initValue);
    };
    return Flow;
}());
exports.Flow = Flow;

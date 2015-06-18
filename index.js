/*
	Simple error collector intended for registering errors on various levels of importance

	Written by Vladimir Neverov <sanguini@gmail.com> in 2014.

	User provides two parameters: id of something that caused an error to occure and an error message.
	Id may be absent, so the message can be the only parameter.

	ErrorHandler additionally stores level of importance, timestamp, stack trace and
	arbitrary application and module names that are provided are arguments to the constructor.

	Constructor accepts three arguments:
		- task - a general name of the application where errors should be collected
		- id   - name of the module
		- settings - error handler settings, reserved for the future
	Both arguments are arbitrary strings and are used only for error identification by humans.

	These errors can later be handled in an arbitrary way, e.g. printed to console, stored
	in a database, emailed, etc.

	Instance interface:
		.info(message)
		.info(id, message)  - register a message at 'info' level
		.warn(message)
		.warn(id, message)  - register a message at 'warning' level
		.fatal(message)
		.fatal(id, message) - register a message at 'fatal' level

		All the methods above does not return anything by convention, so you can do as follows to return undefined:
			return errh.fatal(id, "Cant' bear it anymore")

		.list()             - return errors as array
		.merge(list)        - merge with array of errors or another ErrorHandler instance, returns current ErrorHandler instance
		.stat()             - return object with minimal statistics on errors

		.toString method is redefined so that it returns a string representation of errors, one error per line, so
		you can feed ErrorHandler instance to console.log, for example.

		TODO: add adapters for printing, storing, emailing, etc.
 */

var strace = require('stack-trace'),
	pyfmt = require('pyfmt').upgrade();

module.exports = ErrorHandler;

function ErrorHandler(task, id, settings) {
	this.task = task;
	this.id = id;
	this.settings = settings;
	this.errors = [];
	var self = this;
	this.__defineGetter__("length", function() {
		return self.errors.length;
	});
}

/* public interface */

ErrorHandler.prototype.serialize = function() {
	return {
		error: this.errors,
		task: this.task,
		id: this.id,
		settings: this.settings
	};
}

ErrorHandler.prototype.unserialize = function(s) {
	this.errors = s.error;
	this.task = s.task;
	this.id = s.id;
	this.settings = s.settings;
}

ErrorHandler.prototype.info = function(id, msg) {
	return this.register(id, ErrorHandler.level.info, msg, strace.get());
}

ErrorHandler.prototype.warn = function(id, msg) {
	return this.register(id, ErrorHandler.level.warn, msg, strace.get());
}

ErrorHandler.prototype.fatal = function(id, msg) {
	return this.register(id, ErrorHandler.level.fatal, msg, strace.get());
}

ErrorHandler.prototype.list = function() {
	return this.errors;
}

ErrorHandler.prototype.stat = function() {
	var stat = {
		total: 0
	}
	Object.keys(ErrorHandler.level).map(function(x) { stat[x] = 0; })
	for (var i in this.errors) {
		stat.total += 1;
		var l = this.getLevelName(this.errors[i]);
		if (!l) { l = 'unknown'; }
		if (!stat[l]) { stat[l] = 0; }
		stat[l] += 1;
	}
	return stat;
}

ErrorHandler.prototype.merge = function(list) {
	if (!list) { return this; }
	if (list.constructor === ErrorHandler) {
		if (list === this) { return this; } // do not merge with ourselves
		list = list.list();
	}
	this.errors = this.errors
		.concat(list
			.filter(function(x) { return !!x })
			.map(function(x) {
				if (!x.task) { x.task = ''; }
				if (!x.ns) { x.ns = '';}
				if (!x.level) { x.level = 0; }
				return x;
			})
		)
		.sort(function(a, b) { return a.ts - b.ts; });
	return this;
}

ErrorHandler.prototype.map = function(fn) {
	this.errors = this.errors.map(fn);
}

ErrorHandler.prototype.forEach = function(fn) {
	this.errors.forEach(fn);
}

ErrorHandler.prototype.mangle = function(name, value) {
	if (['ns', 'task', 'level', 'ts', 'stack', 'error', 'id'].indexOf(name) < 0) {
		throw new Error("ErrorHandler.mangle: couldn't set an unknown property");
	}
	this.errors.map(function(x) {
		x[name] = value;
	});
	return this;
}

ErrorHandler.prototype.set = function(name, value, overwrite) {
	if (['ns', 'task'].indexOf(name) < 0) {
		throw new Error("ErrorHandler.set: couldn't set an unknown property");
	}
	this[name] = value;
	if (overwrite) { this.mangle(name, value); }
	return this;
}

/* private methods */

ErrorHandler.level = {
	fatal: 10,
	warn: 20,
	info: 30
}

ErrorHandler.prototype.register = function(id, level, msg, stack) {
	var e;
	if (!msg && id && id.constructor === String) {
		msg = id;
		id = undefined;
	}
	if (id && id.constructor === Object && id.error) {
		e = id;
	} else {
		e = { id: id, error: msg }
	}
	if (!e.level) { e.level = level; }
	if (!e.task) { e.task = this.task; }
	if (!e.ns) { e.ns = this.id; }
	if (!e.ts) { e.ts = (new Date()).getTime(); }
	if (!e.stack && stack) {
		e.stack = stack.slice(1).map(function(x) { return x.toString() });
	}
	this.errors.push(e);
}

ErrorHandler.prototype.toString = function(level) {
	var self = this,
		fmt = "  %(task)s:%(ns)s %(level)7s  %(dept)18s  %(group)25s %(id)10s %(branch)25s %(address)45s | %(error)s\n",
		s = '',
		grp = [];
	this.errors
		.sort(function(a, b) {
			// console.log('cmp', a, b);
			// if (a.id < b.id) { return -1; }
			// else if (a.id > b.id) { return 1; }
			     if (a.dept_name     < b.dept_name    ) { return -1; } else if (a.dept_name     > b.dept_name    ) { return 1; }
			else if (a.group_name    < b.group_name   ) { return -1; } else if (a.group_name    > b.group_name   ) { return 1; }
			else if (a.branch_name   < b.branch_name  ) { return -1; } else if (a.branch_name   > b.branch_name  ) { return 1; }
			else if (a.error         < b.error        ) { return -1; } else if (a.error         > b.error        ) { return 1; }
		});
	// console.log(JSON.stringify(grp));
	var pid;
	this.errors.map(function(y) {
		if (level && y.level > level) { return; }
		s += fmt.pyfmt({
			task: y.task,
			ns: y.ns,
			error: y.error,
			id: y.id || '',
			dept: y.dept_name || '',
			group: y.group_name || '',
			branch: y.branch_name || '',
			address: y.address || '',
			agent: y.agent_name || '',
			level: self.getLevelName(y)
		});
		// if (pid && pid !== y.id) {
			// s += "\n";
		// }
		pid = y.id;
	});
	// for (var i = 0; i < this.errors.length; i++) {
	// 	if (level && this.errors[i].level > level) { continue; }
	// 	s += fmt.pyfmt({
	// 		task: this.errors[i].task,
	// 		ns: this.errors[i].ns,
	// 		error: this.errors[i].error,
	// 		id: this.errors[i].id || '',
	// 		level: this.getLevelName(this.errors[i])
	// 	});
	// }
	return s;
}

ErrorHandler.prototype.inspect = function() { return this.toString(); }

ErrorHandler.prototype.getLevelName = function(e) {
	for (var i in ErrorHandler.level) {
		if (ErrorHandler.level[i] >= e.level) {
			return i;
		}
	}
	return 'unknown';
}


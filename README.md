errh - simple error messages collector
======================================

Written by Vladimir Neverov <sanguini@gmail.com> in 2014.

User provides two parameters: id of something that caused an error to occure and an error message.
Id may be absent, so the message can be the only parameter.

ErrorHandler additionally stores level of importance, timestamp, stack trace and
arbitrary application and module names that are provided are arguments to the constructor.

Constructor accepts three arguments:

 - task - a general name of the application where errors should be collected
 - id   - name of the module
 - settings - error handler settings, reserved for the future

Two first arguments both are arbitrary strings and are used only for error identification by humans.

These errors can later be handled in an arbitrary way, e.g. printed to console, stored
in a database, emailed, etc.

Error register interface:

 - .info(message)
 - .info(id, message)  - register a message at 'info' level
 - .warn(message)
 - .warn(id, message)  - register a message at 'warning' level
 - .fatal(message)
 - .fatal(id, message) - register a message at 'fatal' level

All the methods above does not return anything by convention, so you can do as follows to return undefined:

	return errh.fatal(id, "Cant' bear it anymore")

Other methods:

 - .list()             - return errors as array
 - .merge(list)        - merge with array of errors or another ErrorHandler instance, returns current ErrorHandler instance
 - .stat()             - return object with minimal statistics on errors

.toString method is redefined so that it returns a string representation of errors, one error per line, so
you can feed ErrorHandler instance to console.log, for example. .inspect returns .toString().

TODO: add adapters for printing, storing, emailing, etc.



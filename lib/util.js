"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Util = void 0;
const cronParser = require("cron-parser");
const date = require("date.js");
class Util {
    static calcNextRun(schedule) {
        if (schedule instanceof Date) {
            return schedule.valueOf();
        }
        if (typeof schedule == "number") {
            return Date.now() + schedule;
        }
        try {
            let iterator = cronParser.parseExpression(schedule, { utc: true });
            return iterator.next().getTime();
        }
        catch (e) {
            let time = date(schedule);
            if (time) {
                return time.valueOf();
            }
            throw new Error(`invalid schedule ${schedule}`);
        }
    }
    static calcInterval(schedule) {
        if (schedule instanceof Date) {
            return schedule.valueOf() - Date.now();
        }
        if (typeof schedule == "number") {
            return schedule;
        }
        try {
            let iterator = cronParser.parseExpression(schedule);
            return Math.abs(iterator.next().getTime() - iterator.next().getTime());
        }
        catch (e) {
            let time = date(schedule);
            if (time) {
                return time.valueOf() - Date.now();
            }
            throw new Error(`invalid schedule ${schedule}`);
        }
    }
    static error(err) {
        let output = "";
        if (err) {
            if (err instanceof Error) {
                output = err.stack || err.toString();
            }
            else {
                try {
                    output = JSON.stringify(err);
                }
                catch (e) {
                }
            }
        }
        return output;
    }
}
exports.Util = Util;
//# sourceMappingURL=util.js.map
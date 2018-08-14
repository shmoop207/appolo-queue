"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cronParser = require("cron-parser");
const _ = require("lodash");
const date = require("date.js");
class Util {
    static calcNextRun(schedule) {
        if (schedule instanceof Date) {
            return schedule.valueOf();
        }
        if (_.isNumber(schedule)) {
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
        if (_.isNumber(schedule)) {
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
}
exports.Util = Util;
//# sourceMappingURL=util.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cronParser = require("cron-parser");
const _ = require("lodash");
const date = require("date.js");
const humanInterval = require("human-interval");
class Util {
    static calcNextRun(schedule) {
        if (schedule instanceof Date) {
            return schedule.valueOf();
        }
        if (_.isNumber(schedule)) {
            return Date.now() + schedule;
        }
        return Util.getTimeFromSchedule(schedule);
    }
    static getTimeFromSchedule(schedule) {
        try {
            let iterator = cronParser.parseExpression(schedule);
            return iterator.next().getTime();
        }
        catch (e) {
            let time = humanInterval(schedule);
            if (time) {
                return Date.now() + time;
            }
            if (!time) {
                time = date(schedule);
                return time.valueOf();
            }
            throw new Error(`invalid schedule ${schedule}`);
        }
    }
}
exports.Util = Util;
//# sourceMappingURL=util.js.map
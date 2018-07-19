import cronParser = require('cron-parser');
import _ = require('lodash');
import date = require('date.js');
import humanInterval = require('human-interval');
import {ScheduleType} from "./IOptions";

export class Util {
    public static calcNextRun(schedule: ScheduleType): number {

        if (schedule instanceof Date) {

            return schedule.valueOf();
        }

        if (_.isNumber(schedule)) {
            return Date.now() + schedule;
        }

        return Util.getTimeFromSchedule(schedule);

    }

    public static getTimeFromSchedule(schedule: string) {
        try {
            let iterator = cronParser.parseExpression(schedule);
            return iterator.next().getTime();
        } catch (e) {

            let time = humanInterval(schedule)

            if (time) {
                return Date.now() + time

            }

            if (!time) {
                time = date(schedule);

                return time.valueOf();

            }

            throw new Error(`invalid schedule ${schedule}`)


        }
    }
}
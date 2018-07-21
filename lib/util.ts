import cronParser = require('cron-parser');
import _ = require('lodash');
import date = require('date.js');
import {ScheduleType} from "./IOptions";

export class Util {
    public static calcNextRun(schedule: ScheduleType): number {

        if (schedule instanceof Date) {

            return schedule.valueOf();
        }

        if (_.isNumber(schedule)) {
            return Date.now() + schedule;
        }

        try {
            let iterator = cronParser.parseExpression(schedule);
            return iterator.next().getTime();
        } catch (e) {


            let time = date(schedule);

            if (time) {
                return time.valueOf();
            }

            throw new Error(`invalid schedule ${schedule}`)
        }


    }

    public static calcInterval(schedule: ScheduleType): number {

        if (schedule instanceof Date) {

            return schedule.valueOf() - Date.now();
        }

        if (_.isNumber(schedule)) {
            return schedule;
        }

        try {
            let iterator = cronParser.parseExpression(schedule);
            return Math.abs(iterator.next().getTime() - iterator.next().getTime());
        } catch (e) {


            let time = date(schedule);

            if (time) {
                return   time.valueOf() - Date.now();
            }

            throw new Error(`invalid schedule ${schedule}`)
        }


    }


}
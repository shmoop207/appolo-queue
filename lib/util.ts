import cronParser = require('cron-parser');
import {Numbers} from '@appolo/utils';
import date = require('date.js');
import {ScheduleType} from "./IOptions";

export class Util {
    public static calcNextRun(schedule: ScheduleType): number {

        if (schedule instanceof Date) {

            return schedule.valueOf();
        }

        if (typeof schedule =="number") {
            return Date.now() + schedule;
        }

        try {
            let iterator = cronParser.parseExpression(schedule, {utc: true});
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

        if (typeof schedule =="number") {
            return schedule;
        }

        try {
            let iterator = cronParser.parseExpression(schedule);
            return Math.abs(iterator.next().getTime() - iterator.next().getTime());
        } catch (e) {


            let time = date(schedule);

            if (time) {
                return time.valueOf() - Date.now();
            }

            throw new Error(`invalid schedule ${schedule}`)
        }


    }

    public static error(err: Error): string {
        let output = "";

        if (err) {

            if (err instanceof Error) {
                output = err.stack || err.toString()
            }
            else {
                try {
                    output = JSON.stringify(err)
                } catch (e) {
                }
            }
        }

        return output;
    }


}

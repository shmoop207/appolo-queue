"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const defaults_1 = require("./defaults");
const _ = require("lodash");
class Job {
    constructor(id, options, client, params, data) {
        this._params = {};
        this._id = id;
        this._options = _.defaults({}, options, defaults_1.JobDefaults);
        this._params = params || {};
        this._data = data || { lastRun: 0, runCount: 0, errorCount: 0 };
        this._client = client;
    }
    get id() {
        return this._id;
    }
    get params() {
        return this._params;
    }
    get nextRun() {
        return util_1.Util.calcNextRun(this._options.schedule);
    }
    interval() {
        return this.nextRun - Date.now();
    }
    async lock(time) {
        time = time || this._options.lockLifetime;
        if (time) {
            await this._client.setJobTime(this._id, Date.now() + time);
        }
    }
    run() {
        return this._client.setJobTime(this._id, Date.now());
    }
    runEvery(schedule) {
        this._options.schedule = schedule;
        this._options.repeat = this._options.repeat || 0;
        return this.save();
    }
    runOnce(time) {
        this._options.schedule = time;
        this._options.repeat = this._options.repeat || 1;
        return this.save();
    }
    runNow() {
        return this.runOnce(0);
    }
    cancel() {
        return this._client.removeJob(this._id);
    }
    async ack() {
        this._data.lastRun = Date.now();
        this._options.repeat && (this._data.runCount++);
        this._data.errorCount = 0;
        if (this._options.repeat && this._data.runCount >= this._options.repeat) {
            await this.cancel();
        }
        else {
            await this.save();
        }
    }
    async nack() {
        try {
            this._data.errorCount++;
            let nextRun = (this._data.errorCount <= this._options.retry)
                ? Date.now() + (this._data.errorCount * 1000)
                : this.nextRun;
            await this._save(nextRun);
        }
        catch (e) {
        }
    }
    async _save(nextRun) {
        nextRun = nextRun || this.nextRun;
        if (nextRun - Date.now() < 0) {
            throw new Error(`job next run date is in the past for jobId ${this.id}`);
        }
        await this._client.setJob(this.toJobParam(), nextRun);
    }
    save() {
        return this._save();
    }
    toJobParam() {
        return {
            id: this._id,
            params: this._params,
            options: this._options,
            data: this._data,
        };
    }
}
exports.Job = Job;
//# sourceMappingURL=job.js.map
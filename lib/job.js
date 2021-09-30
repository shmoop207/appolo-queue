"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Job = void 0;
const util_1 = require("./util");
const defaults_1 = require("./defaults");
const events_1 = require("./events");
const events_2 = require("@appolo/events");
const utils_1 = require("@appolo/utils");
class Job extends events_2.EventDispatcher {
    constructor(id, options, client, jobManager, params, data) {
        super();
        this._params = {};
        this._id = id;
        this._isNew = !data;
        this._options = utils_1.Objects.defaults({}, options, defaults_1.JobDefaults);
        this._params = params || {};
        this._data = data || { lastRun: 0, runCount: 0, errorCount: 0, nextRun: Date.now() };
        this._client = client;
        this._jobManager = jobManager;
        this._override = false;
        this._isBindEvents = false;
    }
    repeat(value) {
        this._options.repeat = value;
        return this;
    }
    retry(value) {
        this._options.retry = value;
        return this;
    }
    backoff(value) {
        this._options.backoff = value;
        return this;
    }
    handler(value, options) {
        if (utils_1.Functions.isFunction(value)) {
            this._jobManager.setJobHandler(this.id, value, options);
        }
        else {
            this._options.handler = value;
        }
        return this;
    }
    delay(value) {
        this.repeat(1);
        this._setSchedule(value);
        return this;
    }
    schedule(schedule) {
        this.repeat(null);
        this._setSchedule(schedule);
        return this;
    }
    _setSchedule(schedule) {
        this._options.schedule = schedule;
        this._data.nextRun = util_1.Util.calcNextRun(this._options.schedule);
    }
    lockTime(lockTime) {
        this._options.lockTime = lockTime;
        return this;
    }
    _bindEvents() {
        if (!this._isBindEvents) {
            this._client.on(`${events_1.Events.ClientMessage}:${this.id}`, this._onClientMessage, this);
            this._isBindEvents = true;
        }
    }
    _onClientMessage(data) {
        this.fireEvent(data.eventName, this, data.result);
    }
    on(event, fn, scope) {
        this._bindEvents();
        return super.on(event, fn, scope);
    }
    once(event, fn, scope) {
        this._bindEvents();
        return super.once(event, fn, scope);
    }
    un(event, fn, scope) {
        return super.un(event, fn, scope);
    }
    get id() {
        return this._id;
    }
    get params() {
        return this._params;
    }
    get nextRun() {
        return this._data.nextRun;
    }
    override() {
        this._override = true;
        return this;
    }
    setNextRun(value) {
        this._override = true;
        this._data.nextRun = value;
        return this;
    }
    interval() {
        return util_1.Util.calcInterval(this._options.schedule);
    }
    get options() {
        return this._options;
    }
    get data() {
        return this._data;
    }
    async lock(time) {
        time = time || this._options.lockTime;
        this.setNextRun(Date.now() + time);
        await Promise.all([this.exec(), this._client.addRunningJob(this._id, time)]);
        return this;
    }
    async run(waitForResult = false) {
        if (waitForResult) {
            return this._runWithResult();
        }
        this.setNextRun(Date.now());
        await this.save();
        return this;
    }
    _runWithResult() {
        return new Promise(async (resolve, reject) => {
            this.once(events_1.Events.JobSuccess, (job, result) => resolve(result));
            this.once(events_1.Events.JobFail, (job, result) => reject(result));
            await this.run();
        });
    }
    cancel() {
        this._client.un(`${events_1.Events.ClientMessage}:${this.id}`, this._onClientMessage, this);
        return this._client.removeJob(this._id);
    }
    async exec() {
        await this._validateJobData();
        await this.save();
        return this;
    }
    async save() {
        await this._client.setJob(this.toJobParam(), this._data.nextRun);
        return this;
    }
    async ack(result) {
        if (this._isAcked) {
            return;
        }
        this._isAcked = true;
        this.data.lastRun = Date.now();
        this.options.repeat && (this.data.runCount++);
        this.data.errorCount = 0;
        this.data.status = "success";
        this.data.err = "";
        let promise;
        if (this.options.repeat && this.data.runCount >= this.options.repeat) {
            promise = this.cancel();
        }
        else {
            this.setNextRun(util_1.Util.calcNextRun(this.options.schedule));
            promise = this.exec();
        }
        await Promise.all([promise, this._client.removeRunningJob(this._id)]);
        this._client.publish(events_1.Events.JobSuccess, this.toJobParam(), result);
        this._client.publish(events_1.Events.JobComplete, this.toJobParam());
    }
    async nack(err) {
        if (this._isAcked) {
            return;
        }
        this._isAcked = true;
        try {
            this.data.errorCount++;
            this.data.status = "error";
            this.data.err = util_1.Util.error(err);
            if (this.data.errorCount < this.options.retry) {
                this.setNextRun(Date.now() + (this.data.errorCount * (this.options.backoff || 1000)));
            }
            else {
                this.data.errorCount = 0;
                this.setNextRun(util_1.Util.calcNextRun(this.options.schedule));
            }
            await Promise.all([this.exec(), this._client.removeRunningJob(this._id)]);
        }
        catch (e) {
            this.fireEvent(events_1.Events.Error, util_1.Util.error(e));
        }
        this._client.publish(events_1.Events.JobFail, this.toJobParam(), util_1.Util.error(err) || "job error");
        this._client.publish(events_1.Events.JobComplete, this.toJobParam());
    }
    async _validateJobData() {
        if (this._data.nextRun - Date.now() < 0) {
            this._data.nextRun = Date.now();
        }
        if (!this._isNew || this._override) {
            return;
        }
        let dbJob = await this._client.getJob(this.id);
        if (!dbJob) {
            return;
        }
        this._isNew = false;
        this._data.err = dbJob.data.err;
        this._data.errorCount = dbJob.data.errorCount;
        this._data.lastRun = dbJob.data.lastRun;
        this._data.status = dbJob.data.status;
        this._data.runCount = dbJob.data.runCount;
        if (dbJob.options.schedule == this._options.schedule) {
            this._data.nextRun = dbJob.data.nextRun;
        }
    }
    toJobParam() {
        return {
            id: this._id,
            params: this._params,
            options: this._options,
            data: this._data,
        };
    }
    destroy() {
        if (this._isBindEvents) {
            this._client.removeListenersByScope(this);
        }
        this.removeAllListeners();
        this._client = null;
        this._jobManager = null;
    }
}
exports.Job = Job;
//# sourceMappingURL=job.js.map
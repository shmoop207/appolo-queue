"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const defaults_1 = require("./defaults");
const events_1 = require("./events");
const index_1 = require("appolo-event-dispatcher/index");
const _ = require("lodash");
class Job extends index_1.EventDispatcher {
    constructor(id, options, client, jobManager, params, data) {
        super();
        this._params = {};
        this._id = id;
        this._isNew = !data;
        this._options = _.defaults({}, options, defaults_1.JobDefaults);
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
        if (_.isFunction(value)) {
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
        await this.save();
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
        await this._checkNextTime();
        await this.save();
        return this;
    }
    async save() {
        await this._client.setJob(this.toJobParam(), this._data.nextRun);
        return this;
    }
    async _checkNextTime() {
        if (this._isNew && !this._override) {
            let dbJob = await this._client.getJob(this.id);
            if (dbJob && dbJob.options.schedule == this._options.schedule) {
                this._data.nextRun = dbJob.data.nextRun;
            }
        }
        if (this._data.nextRun - Date.now() < 0) {
            this._data.nextRun = Date.now();
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
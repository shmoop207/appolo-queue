"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("./job");
const appolo_event_dispatcher_1 = require("appolo-event-dispatcher");
const events_1 = require("./events");
const util_1 = require("./util");
const defaults_1 = require("./defaults");
const Q = require("bluebird");
const _ = require("lodash");
class JobsManager extends appolo_event_dispatcher_1.EventDispatcher {
    constructor(_options, _client) {
        super();
        this._options = _options;
        this._client = _client;
        this._handlers = new Map();
    }
    initialize() {
        this._client.on(events_1.Events.ClientMessage, this._onClientMessage, this);
    }
    start() {
        this._setInterval();
        this._isRunning = true;
    }
    _setInterval() {
        clearTimeout(this._interval);
        this._interval = setTimeout(() => this._checkForJobs(), this._options.checkInterval);
    }
    stop() {
        clearTimeout(this._interval);
        this._isRunning = false;
    }
    async _checkForJobs() {
        try {
            let jobsParams = await this._client.getJobsByDate(Date.now(), this._options.maxConcurrency, this._options.lockTime);
            if (!jobsParams.length) {
                return;
            }
            await Q.map(jobsParams, params => this._handleJob(params), { concurrency: this._options.maxConcurrency });
        }
        catch (e) {
            this.fireEvent(events_1.Events.Error, e);
        }
        finally {
            if (this._isRunning) {
                this._setInterval();
            }
        }
    }
    async _handleJob(params) {
        let job = this.createJob(params);
        try {
            let handler = this._handlers.get(params.options.handler) || this._handlers.get(params.id);
            if (!handler) {
                throw new Error(`failed to find handler for job ${job.id}`);
            }
            this._client.publish(events_1.Events.JobStart, job.toJobParam());
            if (handler.options.lockTime || job.options.lockTime) {
                await job.lock(handler.options.lockTime || job.options.lockTime);
            }
            let result = await handler.handler(job);
            await this.ack(job);
            this._client.publish(events_1.Events.JobSuccess, job.toJobParam(), result);
        }
        catch (e) {
            await this.nack(job);
            this._client.publish(events_1.Events.JobFail, job.toJobParam(), e ? e.toString() : "job error");
        }
        job.destroy();
        this._client.publish(events_1.Events.JobComplete, job.toJobParam());
    }
    async ack(job) {
        job.data.lastRun = Date.now();
        job.options.repeat && (job.data.runCount++);
        job.data.errorCount = 0;
        if (job.options.repeat && job.data.runCount >= job.options.repeat) {
            await job.cancel();
        }
        else {
            job.setNextRun(util_1.Util.calcNextRun(job.options.schedule));
            await job.exec();
        }
    }
    async nack(job) {
        try {
            job.data.errorCount++;
            if (job.data.errorCount <= job.options.retry) {
                job.setNextRun(Date.now() + (job.data.errorCount * (job.options.backoff || 1000)));
            }
            else {
                job.setNextRun(util_1.Util.calcNextRun(job.options.schedule));
            }
            await job.exec();
        }
        catch (e) {
            this.fireEvent(events_1.Events.Error, e);
        }
    }
    _onClientMessage(data) {
        let job = this.createJob(data.job);
        this.fireEvent(data.eventName, job, data.result);
    }
    setJobHandler(id, handler, options) {
        options = _.defaults({}, options, defaults_1.HandlerDefaults);
        this._handlers.set(id, { handler, options });
    }
    async getJob(id) {
        let jobParams = await this._client.getJob(id);
        if (!jobParams) {
            return null;
        }
        return this.createJob(jobParams);
    }
    createJob(jobParams) {
        let job = new job_1.Job(jobParams.id, jobParams.options, this._client, this, jobParams.params, jobParams.data);
        return job;
    }
    async getAllJobs() {
        let jobParams = await this._client.getAllJobs();
        return _.map(jobParams, item => this.createJob(item));
    }
    reset() {
        this._client.un(events_1.Events.ClientMessage, this._onClientMessage, this);
    }
}
exports.JobsManager = JobsManager;
//# sourceMappingURL=jobsManager.js.map
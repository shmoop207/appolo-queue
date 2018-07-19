"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("./job");
const appolo_event_dispatcher_1 = require("appolo-event-dispatcher");
const events_1 = require("./events");
const Q = require("bluebird");
const _ = require("lodash");
class JobsManager extends appolo_event_dispatcher_1.EventDispatcher {
    constructor(_options, _client) {
        super();
        this._options = _options;
        this._client = _client;
        this._handlers = new Map();
        this._bindEvents();
    }
    _bindEvents() {
        this._client.on(events_1.Events.JobFail, this._fireEvent, this);
        this._client.on(events_1.Events.JobStart, this._fireEvent, this);
        this._client.on(events_1.Events.JobComplete, this._fireEvent, this);
        this._client.on(events_1.Events.JobFail, this._fireEvent, this);
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
            let jobsParams = await this._client.getJobsByDate(Date.now(), this._options.maxConcurrency, this._options.lockLifetime);
            if (!jobsParams.length) {
                return;
            }
            await Q.map(jobsParams, params => this._handleJob(params), { concurrency: this._options.maxConcurrency });
        }
        catch (e) {
            this.fireEvent(events_1.Events.Error);
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
            await job.lock();
            await handler(job);
            await job.ack();
            this._client.publish(events_1.Events.JobSuccess, job.toJobParam());
        }
        catch (e) {
            await job.nack();
            this._client.publish(events_1.Events.JobFail, job.toJobParam());
        }
        this._client.publish(events_1.Events.JobComplete, job.toJobParam());
    }
    _fireEvent(name, job) {
        this.fireEvent(name, job);
        this.fireEvent(`${name}:${job.id}`, job);
    }
    setJobHandler(id, handler) {
        this._handlers.set(id, handler);
    }
    async getJob(id) {
        let jobParams = await this._client.getJob(id);
        if (!jobParams) {
            return null;
        }
        return this.createJob(jobParams);
    }
    createJob(jobParams) {
        let job = new job_1.Job(jobParams.id, jobParams.options, this._client, jobParams.params, jobParams.data);
        return job;
    }
    async getAllJobs() {
        let jobParams = await this._client.getAllJobs();
        return _.map(jobParams, item => this.createJob(item));
    }
    purge() {
    }
}
exports.JobsManager = JobsManager;
//# sourceMappingURL=jobsManager.js.map
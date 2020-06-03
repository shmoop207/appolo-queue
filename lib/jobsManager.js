"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsManager = void 0;
const job_1 = require("./job");
const appolo_event_dispatcher_1 = require("appolo-event-dispatcher");
const events_1 = require("./events");
const appolo_utils_1 = require("appolo-utils");
const defaults_1 = require("./defaults");
const timers_1 = require("timers");
class JobsManager extends appolo_event_dispatcher_1.EventDispatcher {
    constructor(_options, _client) {
        super();
        this._options = _options;
        this._client = _client;
        this._jobsRunning = 0;
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
        clearInterval(this._interval);
        this._interval = timers_1.setInterval(() => this._checkForJobs(), this._options.checkInterval);
    }
    stop() {
        clearInterval(this._interval);
        this._isRunning = false;
    }
    async _checkForJobs() {
        if (!this._isRunning) {
            return;
        }
        let allRunningJobs = await this._client.countRunningJobs();
        let allMaxJobs = Math.max(this._options.maxConcurrency - allRunningJobs, 0);
        let nodeMaxJobs = Math.max(this._options.maxConcurrencyPerNode - this._jobsRunning, 0);
        let maxJobs = Math.min(nodeMaxJobs, allMaxJobs);
        if (maxJobs <= 0) {
            return;
        }
        try {
            let jobsParams = await this._client.getJobsByDate(Date.now(), maxJobs, this._options.lockTime);
            if (!jobsParams.length) {
                return;
            }
            await appolo_utils_1.Promises.map(jobsParams, params => this._handleJob(params), { concurrency: maxJobs });
        }
        catch (e) {
            this.fireEvent(events_1.Events.Error, e);
        }
        finally {
        }
    }
    async _handleJob(params) {
        if (!this._isRunning) {
            return;
        }
        this._jobsRunning++;
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
            if (this._options.autoAck) {
                await job.ack(result);
            }
        }
        catch (e) {
            await appolo_utils_1.Promises.to(job.nack(e));
        }
        this._jobsRunning--;
        job.destroy();
    }
    _onClientMessage(data) {
        let job = this.createJob(data.job);
        this.fireEvent(data.eventName, job, data.result);
    }
    setJobHandler(id, handler, options) {
        options = appolo_utils_1.Objects.defaults({}, options, defaults_1.HandlerDefaults);
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
        return (jobParams || []).map(item => this.createJob(item));
    }
    reset() {
        this._client.un(events_1.Events.ClientMessage, this._onClientMessage, this);
    }
}
exports.JobsManager = JobsManager;
//# sourceMappingURL=jobsManager.js.map
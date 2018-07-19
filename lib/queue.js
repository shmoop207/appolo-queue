"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("./client");
const defaults_1 = require("./defaults");
const jobsManager_1 = require("./jobsManager");
const _ = require("lodash");
class Queue {
    constructor(_options) {
        this._options = _options;
        this._options = _.defaults({}, _options, defaults_1.QueueDefaults);
        this._client = new client_1.Client(this._options);
        this._jobsManager = new jobsManager_1.JobsManager(this._options, this._client);
        this._jobsManager.fireEvent("ready");
    }
    async initialize() {
        await this._client.connect();
        this._jobsManager.start();
    }
    stop() {
        this._jobsManager.stop();
    }
    handle(id, handler) {
        this._jobsManager.setJobHandler(id, handler);
    }
    runEvery(schedule, id, params, options = {}) {
        return this._addJob(id, params, _.extend({}, options, { schedule: schedule }));
    }
    async runNow(jobId, params, options = {}) {
        return this.runOnce(0, jobId, params, options);
    }
    async runOnce(time, jobId, params, options = {}) {
        return this._addJob(jobId, params, _.extend({}, options, { schedule: time, repeat: 1 }));
    }
    async _addJob(jobId, params, options = {}) {
        if (!options.override) {
            let hasJob = await this.hasJob(jobId);
            if (hasJob) {
                return this.getJob(jobId);
            }
        }
        let job = this.createJob(jobId, params, _.extend({}, options, options));
        await job.save();
        return job;
    }
    async run(jobId) {
        let job = await this.getJob(jobId);
        await job.run();
    }
    createJob(id, params, options = {}) {
        return this._jobsManager.createJob({ id, params, options });
    }
    async getJob(id) {
        return this._jobsManager.getJob(id);
    }
    async getAllJobs() {
        return this._jobsManager.getAllJobs();
    }
    hasJob(id) {
        return this._client.hasJob(id);
    }
    on(event, fn, scope) {
        return this._jobsManager.on(event, fn, scope);
    }
    un(event, fn, scope) {
        return this._jobsManager.un(event, fn, scope);
    }
    removeAllListeners() {
        return this._jobsManager.removeAllListeners();
    }
    async purge() {
        await this._client.purge();
    }
    async reset() {
        await this.purge();
        this.stop();
    }
}
exports.Queue = Queue;
//# sourceMappingURL=queue.js.map
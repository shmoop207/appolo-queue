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
        this._jobsManager.initialize();
    }
    stop() {
        this._jobsManager.stop();
    }
    handle(id, handler, options) {
        this._jobsManager.setJobHandler(id, handler, options);
        return this;
    }
    create(id, params) {
        return this._jobsManager.createJob({ id, params });
    }
    async run(jobId, waitForResult = false) {
        let job = await this.getJob(jobId);
        return job.run(waitForResult);
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
        this._jobsManager.on(event, fn, scope);
        return this;
    }
    once(event, fn, scope) {
        this._jobsManager.once(event, fn, scope);
        return this;
    }
    un(event, fn, scope) {
        this._jobsManager.un(event, fn, scope);
        return this;
    }
    async purge() {
        await this._client.purge();
    }
    async reset() {
        this._jobsManager.reset();
        await this.purge();
        await this._client.quit();
        this.stop();
    }
}
exports.Queue = Queue;
//# sourceMappingURL=queue.js.map
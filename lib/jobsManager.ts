import {IJobParams} from "./IJob";
import {Job} from "./job";
import {Client} from "./client";
import {IOptions} from "./IOptions";
import {EventDispatcher} from "appolo-event-dispatcher";
import {Events} from "./events";
import Q = require("bluebird");
import _ = require("lodash");
import Timer = NodeJS.Timer;

export class JobsManager extends EventDispatcher {

    private _interval: Timer;
    private _handlers: Map<string, (job: Job) => Promise<void>>;
    private _isRunning: boolean;


    constructor(private _options: IOptions, private _client: Client) {
        super();
        this._handlers = new Map();

        this._bindEvents();
    }

    private _bindEvents() {
        this._client.on(Events.JobFail, this._fireEvent, this);
        this._client.on(Events.JobStart, this._fireEvent, this);
        this._client.on(Events.JobComplete, this._fireEvent, this);
        this._client.on(Events.JobFail, this._fireEvent, this);
    }

    public start(): void {
        this._setInterval();
        this._isRunning = true;
    }

    private _setInterval() {
        clearTimeout(this._interval);
        this._interval = setTimeout(() => this._checkForJobs(), this._options.checkInterval)
    }

    public stop(): void {
        clearTimeout(this._interval);
        this._isRunning = false;
    }

    private async _checkForJobs() {

        try {

            let jobsParams = await this._client.getJobsByDate(Date.now(), this._options.maxConcurrency, this._options.lockLifetime);

            if (!jobsParams.length) {
                return;
            }

            await Q.map(jobsParams, params => this._handleJob(params), {concurrency: this._options.maxConcurrency})

        } catch (e) {
            this.fireEvent(Events.Error);
        } finally {

            if (this._isRunning) {
                this._setInterval();
            }
        }
    }

    private async _handleJob(params: IJobParams) {

        let job = this.createJob(params);


        try {

            let handler = this._handlers.get(params.options.handler) || this._handlers.get(params.id);

            if (!handler) {
                throw new Error(`failed to find handler for job ${job.id}`);
            }

            this._client.publish(Events.JobStart, job.toJobParam());

            await job.lock();

            await handler(job);

            await job.ack();

            this._client.publish(Events.JobSuccess, job.toJobParam());

        } catch (e) {

            await job.nack();

            this._client.publish(Events.JobFail, job.toJobParam());
        }

        this._client.publish(Events.JobComplete, job.toJobParam());
    }

    private _fireEvent(name: string, job: Job) {
        this.fireEvent(name, job);
        this.fireEvent(`${name}:${job.id}`, job);
    }

    public setJobHandler(id: string, handler: (job: Job) => Promise<void>) {
        this._handlers.set(id, handler);
    }

    public async getJob(id: string): Promise<Job> {
        let jobParams = await this._client.getJob(id);

        if (!jobParams) {
            return null;
        }

        return this.createJob(jobParams)

    }

    public createJob(jobParams: IJobParams) {
        let job = new Job(jobParams.id, jobParams.options, this._client, jobParams.params, jobParams.data);

        return job;
    }

    public async getAllJobs(): Promise<Job[]> {
        let jobParams = await this._client.getAllJobs();

        return _.map(jobParams, item => this.createJob(item));
    }

    purge() {

    }
}
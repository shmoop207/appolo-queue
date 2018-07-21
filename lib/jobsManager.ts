import {IJobParams} from "./IJob";
import {Job} from "./job";
import {Client} from "./client";
import {IHandlerOptions, IOptions} from "./IOptions";
import {EventDispatcher} from "appolo-event-dispatcher";
import {Events} from "./events";
import {Util} from "./util";
import {HandlerDefaults} from "./defaults";
import Q = require("bluebird");
import _ = require("lodash");
import Timer = NodeJS.Timer;

export class JobsManager extends EventDispatcher {

    private _interval: Timer;
    private _handlers: Map<string, { options: IHandlerOptions, handler: (job: Job) => Promise<any> }>;
    private _isRunning: boolean;


    constructor(private _options: IOptions, private _client: Client) {
        super();
        this._handlers = new Map();
    }

    public initialize() {

        this._client.on(Events.ClientMessage, this._onClientMessage, this);

        this.start();
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
            let jobsParams = await this._client.getJobsByDate(Date.now(), this._options.maxConcurrency, this._options.lockTime);

            if (!jobsParams.length) {
                return;
            }

            await Q.map(jobsParams, params => this._handleJob(params), {concurrency: this._options.maxConcurrency})

        } catch (e) {
            this.fireEvent(Events.Error, e);
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

            if (handler.options.lockTime || job.options.lockTime) {
                await job.lock(handler.options.lockTime || job.options.lockTime);
            }

            let result = await handler.handler(job);

            await this.ack(job);

            this._client.publish(Events.JobSuccess, job.toJobParam(), result);

        } catch (e) {

            await this.nack(job);

            this._client.publish(Events.JobFail, job.toJobParam(), e ? e.toString() : "job error");
        }

        this._client.publish(Events.JobComplete, job.toJobParam());
    }

    public async ack(job: Job): Promise<void> {
        job.data.lastRun = Date.now();
        job.options.repeat && (job.data.runCount++);
        job.data.errorCount = 0;

        if (job.options.repeat && job.data.runCount >= job.options.repeat) {

            await job.cancel();

        } else {

            job.setNextRun(Util.calcNextRun(job.options.schedule));

            await job.exec();
        }
    }

    public async nack(job: Job): Promise<void> {

        try {
            job.data.errorCount++;

            if (job.data.errorCount <= job.options.retry) {
                job.setNextRun(Date.now() + (job.data.errorCount * (job.options.backoff || 1000)))
            } else {
                job.setNextRun(Util.calcNextRun(job.options.schedule));
            }

            await job.exec();

        } catch (e) {
            this.fireEvent(Events.Error, e);
        }
    }

    private _onClientMessage(data: { eventName: string, job: IJobParams, result: any }) {
        let job = this.createJob(data.job);
        this.fireEvent(data.eventName, job, data.result);
    }

    public setJobHandler(id: string, handler: (job: Job) => Promise<any>, options: IHandlerOptions) {

        options = _.defaults({}, options, HandlerDefaults);

        this._handlers.set(id, {handler, options})

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

    public reset() {
        this._client.un(Events.ClientMessage, this._onClientMessage, this);

    }
}
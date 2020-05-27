import {IJobParams} from "./IJob";
import {Job} from "./job";
import {Client} from "./client";
import {IHandlerOptions, IOptions} from "./IOptions";
import {EventDispatcher} from "appolo-event-dispatcher";
import {Events} from "./events";
import {Promises, Objects} from "appolo-utils";
import {HandlerDefaults} from "./defaults";
import {setInterval} from "timers";
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
    }

    public start(): void {
        this._setInterval();
        this._isRunning = true;
    }

    private _setInterval() {
        clearInterval(this._interval);
        this._interval = setInterval(() => this._checkForJobs(), this._options.checkInterval)
    }

    public stop(): void {
        clearInterval(this._interval);
        this._isRunning = false;
    }

    private async _checkForJobs() {

        if (!this._isRunning) {
            return;
        }

        let runningJobs = await this._client.countRunningJobs();

        let maxJobs = this._options.maxConcurrency - runningJobs;

        if (maxJobs <= 0) {
            return;
        }

        try {
            let jobsParams = await this._client.getJobsByDate(Date.now(), maxJobs, this._options.lockTime);

            if (!jobsParams.length) {
                return;
            }

            await Promises.map(jobsParams, params => this._handleJob(params), {concurrency: maxJobs})

        } catch (e) {
            this.fireEvent(Events.Error, e);
        } finally {

        }
    }

    private async _handleJob(params: IJobParams) {
        if (!this._isRunning) {
            return;
        }

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

            if (this._options.autoAck) {
                await job.ack(result);
            }

        } catch (e) {
            await job.nack(e);
        }

        job.destroy();
    }


    private _onClientMessage(data: { eventName: string, job: IJobParams, result: any }) {
        let job = this.createJob(data.job);
        this.fireEvent(data.eventName, job, data.result);
    }

    public setJobHandler(id: string, handler: (job: Job) => Promise<any>, options: IHandlerOptions) {

        options = Objects.defaults({}, options, HandlerDefaults);

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
        let job = new Job(jobParams.id, jobParams.options, this._client, this, jobParams.params, jobParams.data);

        return job;
    }

    public async getAllJobs(): Promise<Job[]> {
        let jobParams = await this._client.getAllJobs();

        return (jobParams || []).map(item => this.createJob(item));
    }

    public reset() {
        this._client.un(Events.ClientMessage, this._onClientMessage, this);

    }
}

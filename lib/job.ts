import {IHandlerOptions, IJobOptions, ScheduleType} from "./IOptions";
import {Util} from "./util";
import {IJobData, IJobParams, JobHandler} from "./IJob";
import {Client} from "./client";
import {JobDefaults} from "./defaults";
import {Events} from "./events";
import {EventDispatcher} from "@appolo/events";
import {JobsManager} from "./jobsManager";
import {Promises, Objects, Functions} from "@appolo/utils";

export class Job extends EventDispatcher {

    private readonly _id: string;
    private _isAcked: boolean;
    private readonly _options: IJobOptions;
    private readonly _params: { [index: string]: any } = {};
    private readonly _data: IJobData;
    private _client: Client;
    private _jobManager: JobsManager;
    private _isNew: boolean;
    private _override: boolean;
    private _isBindEvents: boolean;


    constructor(id: string, options: IJobOptions, client: Client, jobManager: JobsManager, params?: { [index: string]: any }, data?: IJobData) {

        super();

        this._id = id;
        this._isNew = !data;
        this._options = Objects.defaults({}, options, JobDefaults);
        this._params = params || {};
        this._data = data || {lastRun: 0, runCount: 0, errorCount: 0, nextRun: Date.now()};
        this._client = client;
        this._jobManager = jobManager;
        this._override = false;
        this._isBindEvents = false;

    }

    public repeat(value: number): this {
        this._options.repeat = value;
        return this;
    }

    public retry(value: number): this {
        this._options.retry = value;
        return this;
    }

    public backoff(value: number): this {
        this._options.backoff = value;
        return this;
    }

    public handler(value: JobHandler | string, options?: IHandlerOptions): this {

        if (Functions.isFunction(value)) {
            this._jobManager.setJobHandler(this.id, value as JobHandler, options)
        } else {
            this._options.handler = value;
        }

        return this;
    }

    public delay(value: ScheduleType): this {
        this.repeat(1);

        this._setSchedule(value);

        return this;
    }

    public schedule(schedule: ScheduleType): this {

        this.repeat(null);

        this._setSchedule(schedule);

        return this;
    }

    private _setSchedule(schedule: ScheduleType) {

        this._options.schedule = schedule;
        this._data.nextRun = Util.calcNextRun(this._options.schedule)

    }

    public lockTime(lockTime: number): this {
        this._options.lockTime = lockTime;

        return this;
    }

    private _bindEvents() {
        if (!this._isBindEvents) {
            this._client.on(`${Events.ClientMessage}:${this.id}`, this._onClientMessage, this);
            this._isBindEvents = true;
        }

    }

    private _onClientMessage(data: { eventName: string, job: IJobParams, result: any }) {

        this.fireEvent(data.eventName, this, data.result);
    }

    public on(event: Events.JobComplete | Events.JobSuccess | Events.JobFail | Events.JobStart, fn: (...args: any[]) => any, scope?: any) {
        this._bindEvents();
        return super.on(event, fn, scope)
    }

    public once(event: Events.JobComplete | Events.JobSuccess | Events.JobFail | Events.JobStart, fn: (...args: any[]) => any, scope?: any) {
        this._bindEvents();
        return super.once(event, fn, scope)
    }

    public un(event: Events.JobComplete | Events.JobSuccess | Events.JobFail | Events.JobStart, fn: (...args: any[]) => any, scope?: any) {
        return super.un(event, fn, scope)
    }

    public get id(): string {
        return this._id;
    }

    public get params(): { [index: string]: any } {
        return this._params;
    }

    public get nextRun(): number {

        return this._data.nextRun;
    }

    public override(): this {
        this._override = true;
        return this;
    }

    public setNextRun(value: number): this {
        this._override = true;
        this._data.nextRun = value;
        return this;
    }

    public interval(): number {
        return Util.calcInterval(this._options.schedule)
    }

    public get options(): IJobOptions {
        return this._options;
    }

    public get data(): IJobData {
        return this._data;
    }

    public async lock(time?: number): Promise<this> {
        time = time || this._options.lockTime;

        this.setNextRun(Date.now() + time);

        await Promise.all([this.exec(), this._client.addRunningJob(this._id, time)]);


        return this;
    }

    public async run(waitForResult: boolean = false): Promise<this | any> {

        if (waitForResult) {
            return this._runWithResult();
        }

        this.setNextRun(Date.now());

        await this.save();

        return this;
    }

    private _runWithResult(): Promise<any> {
        return new Promise(async (resolve, reject) => {
            this.once(Events.JobSuccess, (job: IJobParams, result) => resolve(result));
            this.once(Events.JobFail, (job: IJobParams, result) => reject(result));
            await this.run();
        })
    }

    public cancel(): Promise<void> {
        this._client.un(`${Events.ClientMessage}:${this.id}`, this._onClientMessage, this);

        return this._client.removeJob(this._id);

    }


    public async exec(): Promise<this> {

        await this._validateJobData();

        await this.save();

        return this;
    }

    public async save(): Promise<this> {

        await this._client.setJob(this.toJobParam(), this._data.nextRun);

        return this;
    }

    public async ack(result?: any): Promise<void> {

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

        } else {

            this.setNextRun(Util.calcNextRun(this.options.schedule));

            promise = this.exec();
        }

        await Promise.all([promise, this._client.removeRunningJob(this._id)]);

        this._client.publish(Events.JobSuccess, this.toJobParam(), result);

        this._client.publish(Events.JobComplete, this.toJobParam());

    }

    public async nack(err?: Error): Promise<void> {

        if (this._isAcked) {
            return;
        }

        this._isAcked = true;

        try {
            this.data.errorCount++;
            this.data.status = "error";
            this.data.err = Util.error(err);

            if (this.data.errorCount < this.options.retry) {
                this.setNextRun(Date.now() + (this.data.errorCount * (this.options.backoff || 1000)))
            } else {
                this.data.errorCount = 0;
                this.setNextRun(Util.calcNextRun(this.options.schedule));
            }

            await Promise.all([this.exec(), this._client.removeRunningJob(this._id)]);

        } catch (e) {
            this.fireEvent(Events.Error, Util.error(e));
        }

        this._client.publish(Events.JobFail, this.toJobParam(), Util.error(err) || "job error");
        this._client.publish(Events.JobComplete, this.toJobParam());

    }

    private async _validateJobData() {
        if (this._data.nextRun - Date.now() < 0) {
            this._data.nextRun = Date.now();
        }

        if (!this._isNew || this._override) {
            return
        }

        let dbJob = await this._client.getJob(this.id);

        if (!dbJob) {
            return
        }

        this._isNew = false;

        this._data.err = dbJob.data.err
        this._data.errorCount = dbJob.data.errorCount
        this._data.lastRun = dbJob.data.lastRun;
        this._data.status = dbJob.data.status;
        this._data.runCount = dbJob.data.runCount;

        if (dbJob.options.schedule == this._options.schedule) {
            this._data.nextRun = dbJob.data.nextRun
        }


    }

    public toJobParam(): IJobParams {
        return {
            id: this._id,
            params: this._params,
            options: this._options,
            data: this._data,
        }
    }

    public destroy() {


        if (this._isBindEvents) {
            this._client.removeListenersByScope(this);
        }


        this.removeAllListeners();
        this._client = null;
        this._jobManager = null;

    }


}

import {IJobOptions, IOptions, ScheduleType} from "./IOptions";
import {Client} from "./client";
import {Job} from "./job";
import {QueueDefaults} from "./defaults";
import {JobsManager} from "./jobsManager";
import {EventDispatcher} from "appolo-event-dispatcher";
import _ = require("lodash");

export class Queue {

    private _client: Client;
    private _jobsManager: JobsManager;


    constructor(private _options: IOptions) {


        this._options = _.defaults({}, _options, QueueDefaults);

        this._client = new Client(this._options);

        this._jobsManager = new JobsManager(this._options, this._client);

        this._jobsManager.fireEvent("ready");
    }

    public async initialize(): Promise<void> {
        await this._client.connect();

        this._jobsManager.start();

    }

    public stop() {
        this._jobsManager.stop();
    }


    public handle(id: string, handler: (job: Job) => any) {
        this._jobsManager.setJobHandler(id, handler);
    }


    public runEvery(schedule: ScheduleType, id: string, params?: { [index: string]: any }, options: IJobOptions = {}): Promise<Job> {
        return this._addJob(id, params, _.extend({}, options, {schedule: schedule}));
    }

    public async runNow(jobId: string, params?: { [index: string]: any }, options: IJobOptions = {}): Promise<Job> {

        return this.runOnce(0, jobId, params, options)
    }

    public async runOnce(time:ScheduleType, jobId: string, params?: { [index: string]: any }, options: IJobOptions = {}): Promise<Job> {

        return this._addJob(jobId, params, _.extend({}, options, {schedule: time, repeat: 1}));
    }

    private async _addJob(jobId: string, params?: { [index: string]: any }, options: IJobOptions = {}) {

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

    public async run(jobId: string): Promise<void> {

        let job = await this.getJob(jobId);

        await job.run();
    }


    public createJob(id: string, params?: { [index: string]: any }, options: IJobOptions = {}): Job {

        return this._jobsManager.createJob({id, params, options});
    }

    public async getJob(id: string): Promise<Job> {
        return this._jobsManager.getJob(id)
    }

    public async getAllJobs(): Promise<Job[]> {
        return this._jobsManager.getAllJobs()
    }

    public hasJob(id: string): Promise<boolean> {
        return this._client.hasJob(id)
    }

    public on(event: string, fn: (...args: any[]) => any, scope?: any): EventDispatcher {
        return this._jobsManager.on(event, fn, scope);
    }

    public un(event: string, fn: (...args: any[]) => any, scope?: any): EventDispatcher {
        return this._jobsManager.un(event, fn, scope);
    }

    public removeAllListeners(): EventDispatcher {
        return this._jobsManager.removeAllListeners();
    }

    public async purge() {
        await this._client.purge();
    }

    public async reset() {
        await this.purge();
        this.stop();
    }


}
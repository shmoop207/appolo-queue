# Appolo Queue
Distributed  job queue build with redis and typescript

## Features

  - Delayed jobs
  - Scheduled jobs with corn or human readable syntax.
  - Distribution of parallel multi server job execution
  - Promise Api
  - Retries on failure
  - Powered by Redis

## Installation
```javascript
npm install appolo --save
```


## Initialize
create queue instance with the following `options`:
- `redis`: redis connection string
- `queueName` queue prefix in redis `default: appolo-queue`
- `checkInterval` queue check time in milesec `default: 1000`
- `maxConcurrency` max number of jobs to process in parallel per server `default: 1`
- `lockTime` interval in ms of how long the job stays locked when pulled from the queue  `default: 60000`

```js
    queue = new Queue({redis: "localhost:"});

    await queue.initialize();
```

## Create Job

#### `create(jobId, [params]):Job`
creates new job instance `params` optional object pasted to the handler
in the end call `exec` to save the job the task will be run `Date.now()`
each job must have uniq id
```js
    queue.handle("test", async (job)=>{
        console.log(job.params.param)
    });

   await queue.create("test", {param: "value"})
         .exec();
```
#### `delay(time):Job`
create delayed job where time one of the following
the job will run only once
- interval in milisec
- date object
- string in [date](https://github.com/MatthewMueller/date) syntax
```js
    let job = await queue.create("test", {param: "value"})
        .delay(2000)
        .exec();

    await queue.create("test", {param: "value"})
        .delay("in 5 hours")
        .exec();
```

#### `schedule(time):Job`
create scheduled job where time one of the following
the job will run every interval
- interval in milisec
- cron job syntax
- date object
- string in  [date](https://github.com/MatthewMueller/date) syntax
```js
    let job = await queue.create("test", {param: "value"})
        .scedule(10 * 60 * 1000)
        .exec();

    await queue.create("test", {param: "value"})
        .delay("every 10 minutes")
        .exec();

    await queue.create("test", {param: "value"})
            .delay("* */10 * * * *")
            .exec();
```

### Handle jobs
Each job has it's own handler
The handler will be called with the job instance and return promise with the job result


#### `handle(jobId,handler,[options]):Queue`
adds handler to queue by job id
`options`:
- `lockTime`: interval in milisec lock the job while the handler is running
```js
    queue.handle("test", async (job)=>{
        console.log(job.params.param)

        let result = await  doSomething(ob.params.someValue)

        return result
    });

   await queue.create("test", {someValue: "value"})
         .exec();
```

## handler with multiple jobs
you can define one handler to handle multi jobs

```js
    queue.handle("test", async (job)=>{
       //do something
    });

    await queue.create("someId", {someValue: "value"})
         .handler("test")
         .exec();

    await queue.create("someId2", {someValue: "value"})
        .handler("test")
        .exec();
```

## Job
```js
await queue.create("someId2", {someValue: "value"})
    .handler("test")
    .lockTime(10*60*1000) // 10 min
    .repeat(2)
    .retry(3)
    .backoff()
    .exec();
```

#### `lockTime(lockTime: number):Job`
change job lock time default: 60000

#### `repeat(value: number):Job`
set the max number of time job will run the default fro schedule in unlimited and for delayed is 1

#### `retry (value: number):Job`
set the number of retries on job fail default :10 when the number is reached will reschedule the job

#### `backoff(value: number) :Job`
set interval in milisec for each retry backoff default:1000

#### `handler(value: string) :Job`
set job handler id
#### `exec() :Promise<Job>`
save the job to redis

#### `run(waitForResults:boolean) :Promise<Job> | Promise<any>`
save the job to redis and run it immediately if waitForResults then promise returned with job result
```js
try{

   let returl =  await queue.create("someId2", {someValue: "value"})
    .run(true);

}catch(e){
    //job result error
}
```
#### `cancel() :Promise<void>`
cancel the job and delete from redis

#### `get id():string`
return job id
#### `get  params():any`
return job params
#### `get nextRun(): number`
return job next run unix milisec
#### `get interval(): number`
return job next run interval milisec
#### `get options()`
return job options

### Job Events
Job events are fired on the Job instances via Redis pubsub
all callbacks called with the job instance

- `Events.JobStart` the job is pulled from the queue and the handler is called
- `Events.JobSuccess` job run is completed successfully result is added the callback args
- `Events.JobFail` job run is failed with error
- `Events.JobComplete` job run is success or failed and the job is returned to the queue

```js
let job = await queue.create("someId2", {someValue: "value"})
    .handler("test")
    .once(Events.JobSuccess,(job,result)=>console.log('weeeee'))
    .exec();
```

#### `on(eventName,callback, [scope]):Job`
register event listener

#### `once(eventName,callback, [scope]):Job`
register event listener, will be removed after one call

#### `un(eventName,callback, [scope]):Job`
remove event listener


## Queue

#### `start()`
start pulling jobs from the queue
#### `stop()`
stop pulling jobs from the queue

#### `run(jobId: string,waitForResult:boolean): Promise<this | any>`
run job by id return the instance of job result when waitForResult

#### `getJob(id: string): Promise<Job>`
get job instance by id

#### `getJob(): Promise<Job[]>`
get all jobs in the queue

#### `hasJob(id: string): Promise<boolean>`
return true if job id exist in the queue

### Queue Events
Job events are fired on the Job instances via Redis pubsub
all callbacks called with the job instance

- `Events.JobStart` - the job is pulled from the queue and the handler is called
- `Events.JobSuccess` - job run is completed successfully result is added the callback args
- `Events.JobFail` job - run is failed with error
- `Events.JobComplete` - job run is success or failed and the job is returned to the queue
- `Events.Ready` - the queue finish initialize and start pull interval
- `Events.Error` - some error occurred during the job process

```js
await queue.create("someIs", {someValue: "value"})
    .exec();

queue.once(Events.JobSuccess,(job,result)=>console.log(job.id))

queue.on(Events.Error,(e)=>console.log(e))

```

#### `on(eventName,callback, [scope]):Queue`
register event listener

#### `once(eventName,callback, [scope]):Queue`
register event listener, will be removed after one call

#### `un(eventName,callback, [scope]):Queue`
remove event listener

#### `purge()`
delete all jobs in the queue

#### `reset()`
stop job pulling and purge the queue

## License
MIT
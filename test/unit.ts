
import chai = require("chai");
import sinon = require("sinon");
import sinonChai = require("sinon-chai");
import {Promises} from "@appolo/utils";
import  moment = require('moment');
import {SinonFakeTimers} from "sinon";
import {Job} from "../lib/job";
import {Events} from "../lib/events";
import {Queue} from "../index"
import {Util} from "../lib/util";
import {Arrays} from "@appolo/utils";




chai.use(sinonChai);

let should = chai.should();


describe("Queue", () => {
    let clock: SinonFakeTimers, queue: Queue;


    if (!process.env.REDIS) {
        throw new Error(`please define process.env.REDIS`)
    }


    beforeEach(async () => {


        queue = new Queue({redis: process.env.REDIS, checkInterval: 10,queueName:"test-queue"});

        await queue.initialize();

        await queue.purge();


    });

    afterEach(async () => {
        try {
            await queue.reset();
        } catch (e) {
            console.error(e)
        }


    });


    it("Should run once delayed job ", async () => {

        let spy = sinon.spy();

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"})
            .delay(200)
            .exec();

        await Promises.delay(50);

        spy.should.be.not.called;

        await Promises.delay(200);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

    });

    it("Should run now job ", async () => {

        let spy = sinon.spy(async (...args:any[]) => {
        });

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"})
            .exec();

        await Promises.delay(500);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");


    });

    it("Should run schedule job", async () => {

        let spy = sinon.spy(async (...args:any[]) => {
        });

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"})
            .schedule("every 1 seconds")
            .exec();

        await Promises.delay(300);

        spy.should.be.not.called;

        await Promises.delay(3000);

        spy.should.be.calledTwice;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

    });

    it("Should run schedule job using date syntax ", async () => {

        await queue.initialize();

        let spy = sinon.spy(async (...args:any[]) => {
        });

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"}).schedule("1 second from now").exec();

        await Promises.delay(300);

        spy.should.be.not.called;

        await Promises.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

    });


    it("Should run schedule job using cron syntax ", async () => {


        let spy = sinon.spy();

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"}).schedule("* * * * * *").exec();

        await Promises.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");


    });

    it("Should run schedule job using milisecond syntax ", async () => {

        let spy = sinon.spy(async (...args:any[]) => {
        });

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"}).delay(1000).exec();

        await Promises.delay(300);

        spy.should.be.not.called;

        await Promises.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

    });

    it("Should run schedule job using date object ", async () => {


        let spy = sinon.spy(async (...args:any[]) => {
        });

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"}).delay(new Date(Date.now() + 1000)).exec();

        await Promises.delay(300);

        spy.should.be.not.called;

        await Promises.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

    });


    it("Should fire events ", async () => {

        let spy = sinon.spy();
        let spy2 = sinon.spy();

        queue.handle("test", (job: Job) => {

        });

        let job = await queue.create("test", {param1: "testParam"}).schedule("1 second from now").exec();

        queue.on(Events.JobSuccess, spy);

        job.on(Events.JobSuccess, spy2);


        await Promises.delay(1900);

        spy.should.be.calledOnce;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        spy2.should.be.calledOnce;
        spy2.getCall(0).args[0].id.should.be.eq("test");
        spy2.getCall(0).args[0].params.param1.should.be.eq("testParam");


    });

    it("Should get result events ", async () => {

        let spy = sinon.spy();
        let spy2 = sinon.spy();

        queue.handle("test", async (job: Job) => {
            return "working"
        });

        let job = await queue.create("test", {param1: "testParam"}).schedule("1 second from now").exec();

        queue.on(Events.JobSuccess, spy);

        job.on(Events.JobSuccess, spy2);


        await Promises.delay(1500);

        spy.should.be.calledOnce;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");
        spy.getCall(0).args[1].should.be.eq("working");

        spy2.should.be.calledOnce;
        spy2.getCall(0).args[0].id.should.be.eq("test");
        spy2.getCall(0).args[0].params.param1.should.be.eq("testParam");
        spy2.getCall(0).args[1].should.be.eq("working");


    });

    it("Should fire error events ", async () => {

        let spy = sinon.spy();
        let spy2 = sinon.spy();

        queue.handle("test", async (job: Job) => {
            throw new Error("not working");
        });

        let job = await queue.create("test", {param1: "testParam"}).schedule("1 second from now").exec();

        queue.on(Events.JobFail, spy);

        job.on(Events.JobFail, spy2);


        await Promises.delay(1500);

        spy.should.be.calledOnce;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");
        spy.getCall(0).args[1].toString().should.include("Error: not working");

        spy2.should.be.calledOnce;
        spy2.getCall(0).args[0].id.should.be.eq("test");
        spy2.getCall(0).args[0].params.param1.should.be.eq("testParam");
        spy2.getCall(0).args[1].toString().should.include("Error: not working");


    });


    it("Should run multi schedule job using date syntax ", async () => {
        await queue.reset();


        queue = new Queue({redis: process.env.REDIS, checkInterval: 10, maxConcurrency: 2});

        await queue.initialize();

        let spy = sinon.spy();
        let spy2 = sinon.spy();

        queue.handle("test", spy);
        queue.handle("test2", spy2);

        await queue.create("test", {param1: "testParam"}).schedule("1 second from now").exec();
        await queue.create("test2", {param1: "testParam2"}).schedule("1 second from now").exec();

        await Promises.delay(1300);

        spy.should.be.calledOnce;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        spy2.should.be.calledOnce;
        spy2.getCall(0).args[0].id.should.be.eq("test2");
        spy2.getCall(0).args[0].params.param1.should.be.eq("testParam2");


    });

    it("Should get all jobs ", async () => {


        await queue.initialize();

        let spy = sinon.spy();
        let spy2 = sinon.spy();

        queue.handle("test", spy);
        queue.handle("test2", spy2);

        await queue.create("test", {param1: "testParam"}).schedule("1 second from now").exec();
        await queue.create("test2", {param1: "testParam2"}).schedule("1 second from now").exec();

        await Promises.delay(300);

        let jobs = await queue.getAllJobs();

        jobs = Arrays.sortBy(jobs,job=>job.id);

        jobs[0].id.should.be.eq("test");
        jobs[0].params.param1.should.be.eq("testParam");


        jobs[1].id.should.be.eq("test2");
        jobs[1].params.param1.should.be.eq("testParam2");


    });

    it("Should run different jobs with same handler ", async () => {


        await queue.initialize();

        let spy = sinon.spy();

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"}).schedule("1 second from now").handler("test").exec();
        await queue.create("test2", {param1: "testParam2"}).schedule("1 second from now").handler("test").exec();

        await Promises.delay(1300);

        spy.should.be.calledTwice;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");


        spy.getCall(1).args[0].id.should.be.eq("test2");
        spy.getCall(1).args[0].params.param1.should.be.eq("testParam2");

    });

    it("Should run different jobs with same handler fn", async () => {


        await queue.initialize();

        let spy = sinon.spy();


        await queue.create("test", {param1: "testParam"}).schedule("1 second from now").handler(spy).exec();
        await queue.create("test2", {param1: "testParam2"}).schedule("1 second from now").handler(spy).exec();

        await Promises.delay(1500);

        spy.should.be.calledTwice;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");


        spy.getCall(1).args[0].id.should.be.eq("test2");
        spy.getCall(1).args[0].params.param1.should.be.eq("testParam2");

    });

    it("Should delete job form queue after run ", async () => {

        let spy = sinon.spy();

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"}).delay("1 second from now").exec();

        await Promises.delay(1300);

        spy.should.be.calledOnce;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");


        let job = await queue.getJob("test")

        should.not.exist(job)


    });

    it("Should not change schedule if exist ", async () => {

        let spy = sinon.spy();

        queue.handle("test", spy);

        await queue.create("test", {param1: "testParam"})
            .delay("1 second from now")
            .exec();

        await Promises.delay(200);

        await queue.create("test", {param1: "testParam"}).delay("1 second from now").exec();

        await Promises.delay(1500);


        spy.should.be.calledOnce;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");


        let job = await queue.getJob("test")

        should.not.exist(job)


    });

    it("Should calc next run with utc ", async () => {
        let time = Util.calcNextRun("0 0 0 * * *");

        let date = moment.utc().add(1, "day").startOf("day").valueOf();

        time.should.be.eq(date)
    })

    it("Should run with wait for result ", async () => {

        queue.handle("test", () => "working");

        let data = await queue.create("test", {param1: "testParam"})
            .run(true);

        data.should.be.eq("working")

    });

    it("Should run existing task", async () => {

        queue.handle("test", () => "working");

        await queue.create("test")
            .schedule(1000000)
            .exec();

        let data = await queue.create("test")
            .schedule(1000000)
            .run(true);

        data.should.be.eq("working")

    });

    it("Should get valid interval ", async () => {

        queue.handle("test", () => "working");

        let job = queue.create("test", {param1: "testParam"})
            .schedule("every 10 minutes");


        job.interval().should.be.eq(600000);

        job = queue.create("test", {param1: "testParam"})
            .schedule("0 */10 * * * *");


        job.interval().should.be.eq(600000)

    });


});


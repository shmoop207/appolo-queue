import chai = require("chai");
import sinon = require("sinon");
import sinonChai = require("sinon-chai");
import Q = require("bluebird");
import {Queue} from "../index"
import {SinonFakeTimers} from "sinon";
import {Job} from "../lib/job";

chai.use(sinonChai);

let should = chai.should();

const redis = "redis://redistogo:e630f8e0a37be146c941d01bd91fbab7@cod.redistogo.com:11661" //redis go free redis


describe("Queue", () => {
    let clock: SinonFakeTimers
    beforeEach(async () => {
        //clock = sinon.useFakeTimers(new Date());
    });

    afterEach(async () => {
        // clock.restore();
    });


    it("Should run once delayed job ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10});

        await queue.initialize();

        let spy = sinon.spy(async () => {
        });

        queue.handle("test", spy);

        await queue.runOnce(100, "test", {param1: "testParam"});

        await Q.delay(50);

        spy.should.be.not.called;

        await Q.delay(300);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        await queue.reset();

    });

    it("Should run now job ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10});

        await queue.initialize();

        let spy = sinon.spy(async () => {
        });

        queue.handle("test", spy);

        await queue.runNow("test", {param1: "testParam"});

        await Q.delay(300);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        await queue.reset();

    });

    it("Should run schedule job", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10});

        await queue.initialize();

        let spy = sinon.spy(async () => {
        });

        queue.handle("test", spy);

        await queue.runEvery("every second", "test", {param1: "testParam"});

        await Q.delay(300);

        spy.should.be.not.called;

        await Q.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        await queue.reset();

    });

    it("Should run schedule job using date syntax ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10});

        await queue.initialize();

        let spy = sinon.spy(async () => {
        });

        queue.handle("test", spy);

        await queue.runOnce("1 second from now", "test", {param1: "testParam"});

        await Q.delay(300);

        spy.should.be.not.called;

        await Q.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        await queue.reset();

    });


    it("Should run schedule job using cron syntax ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10});

        await queue.initialize();

        let spy = sinon.spy(async () => {
        });

        queue.handle("test", spy);

        await queue.runOnce("* * * * * *", "test", {param1: "testParam"});

        await Q.delay(300);

        spy.should.be.not.called;

        await Q.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        await queue.reset();

    });

    it("Should run schedule job using milisecond syntax ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10});

        await queue.initialize();

        let spy = sinon.spy(async () => {
        });

        queue.handle("test", spy);

        await queue.runOnce(1000, "test", {param1: "testParam"});

        await Q.delay(300);

        spy.should.be.not.called;

        await Q.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        await queue.reset();

    });

    it("Should run schedule job using date object ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10});

        await queue.initialize();

        let spy = sinon.spy(async () => {
        });

        queue.handle("test", spy);

        await queue.runOnce(new Date(Date.now() + 1000), "test", {param1: "testParam"});

        await Q.delay(300);

        spy.should.be.not.called;

        await Q.delay(1000);

        spy.should.be.calledOnce;

        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        await queue.reset();

    });


    it("Should fire events ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10});

        await queue.initialize();

        let spy = sinon.spy();
        let spy2 = sinon.spy();

        queue.handle("test", (job: Job) => {

        });

        await queue.runEvery("1 second from now", "test", {param1: "testParam"});

        queue.on("jobSuccess", spy);
        queue.on("jobSuccess:test", spy2);


        await Q.delay(1400);

        spy.should.be.calledOnce;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        spy2.should.be.calledOnce;
        spy2.getCall(0).args[0].id.should.be.eq("test");
        spy2.getCall(0).args[0].params.param1.should.be.eq("testParam");

        await queue.reset();

    });


    it("Should run multi schedule job using date syntax ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10, maxConcurrency: 2});

        await queue.initialize();

        let spy = sinon.spy();
        let spy2 = sinon.spy();

        queue.handle("test", spy);
        queue.handle("test2", spy2);

        await queue.runOnce("1 second from now", "test", {param1: "testParam"});
        await queue.runOnce("1 second from now", "test2", {param1: "testParam2"});

        await Q.delay(1300);

        spy.should.be.calledOnce;
        spy.getCall(0).args[0].id.should.be.eq("test");
        spy.getCall(0).args[0].params.param1.should.be.eq("testParam");

        spy2.should.be.calledOnce;
        spy2.getCall(0).args[0].id.should.be.eq("test2");
        spy2.getCall(0).args[0].params.param1.should.be.eq("testParam2");

        await queue.reset();

    });

    it("Should get all jobs ", async () => {
        let queue = new Queue({redis: redis, checkInterval: 10, maxConcurrency: 2});

        await queue.initialize();

        let spy = sinon.spy();
        let spy2 = sinon.spy();

        queue.handle("test", spy);
        queue.handle("test2", spy2);

        await queue.runOnce("1 second from now", "test", {param1: "testParam"});
        await queue.runOnce("1 second from now", "test2", {param1: "testParam2"});

        await Q.delay(300);

        let jobs = await queue.getAllJobs();

        spy.should.be.not.calledOnce;
        jobs[0].id.should.be.eq("test");
        jobs[0].params.param1.should.be.eq("testParam");


        jobs[1].id.should.be.eq("test2");
        jobs[1].params.param1.should.be.eq("testParam2");

        await queue.reset();

    });

});


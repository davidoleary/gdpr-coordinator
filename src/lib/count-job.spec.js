import { expect } from 'chai';
import mongoose from 'mongoose';
import { Mockgoose } from 'mockgoose';
import count from './count-job';
import RequestCount from '../models/request-count';
import { open } from '../lib/mongodb-connect';

const mockgoose = new Mockgoose(mongoose);

describe('Count job', () => {
  before((done) => {
    open().then(() => {
      done();
    }).catch(done);
  });

  beforeEach(async () => {
    mockgoose.helper.reset();

    const notOldNotNew = {
      count: 5,
    };

    const newEntry = new RequestCount(notOldNotNew);
    await newEntry.save();
  });

  afterEach((done) => {
    mockgoose.helper.reset();
    done();
  });

  it('sets the count back to zero', async () => {
    await count();

    const result = await RequestCount.findOne({});
    expect(result.count).to.equal(0);
  });
});


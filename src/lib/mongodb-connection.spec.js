import sinon from 'sinon';
import mongoose from 'mongoose';

import { open } from '../lib/mongodb-connect';

describe('mongodb-connect', () => {
  let connectMock;
  beforeEach(() => {
    connectMock = sinon.stub(mongoose, 'connect').yields(null);
  });

  afterEach((done) => {
    connectMock.restore();
    done();
  });

  it('connects to db', (done) => {
    open().then(() => {
      sinon.assert.calledOnce(connectMock);
      done();
    });
  });
});

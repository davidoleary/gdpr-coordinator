import { expect } from 'chai';
import uuid from 'uuid';
import { stub } from 'sinon';
import { Response, ErrorResponse } from './response';

describe('Response', () => {
  it('Set content and get response', () => {
    const expected = {
      a: 'hello',
      b: 'world',
    };

    const r = new Response();
    r.setContent(expected);
    const response = r.getResponse();

    expect(response).to.contain.key('content');
    expect(response.content).to.deep.equal(expected);
  });
});

describe('ErrorResponse', () => {
  before(() => {
    stub(uuid, 'v4').returns('1234');
  });

  after(() => {
    uuid.v4.restore();
  });

  it('Set error and get response', () => {
    const expected = {
      error: {
        message: 'this is an error',
        code: 999,
        uuid: '1234',
      },
    };

    const r = new ErrorResponse();
    r.setError('this is an error', 999);
    const response = r.getResponse();

    expect(response).to.have.property('content');
    expect(response.content).to.deep.equal(expected);
  });
});

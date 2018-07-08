import { expect } from 'chai';
import { generateOnewayHash } from './hashing';

describe('hashing', () => {
  beforeEach((done) => {
    done();
  });

  afterEach((done) => {
    done();
  });

  it('generates the same hash given the same input', (done) => {
    const first = generateOnewayHash('david.oleary@somecompany.com', 'SFID1');
    const second = generateOnewayHash('david.oleary@somecompany.com', 'SFID1');
    expect(first).to.equal(second);
    done();
  });

  it('generates differen hash given different salt input', (done) => {
    const first = generateOnewayHash('david.oleary@somecompany.com', 'SFID1');
    const second = generateOnewayHash('david.oleary@somecompany.com', 'SFID2');
    expect(first).to.not.equal(second);
    done();
  });

  it('generates differen hash given different value input', (done) => {
    const first = generateOnewayHash('david.oleary@somecompany.com', 'SFID1');
    const second = generateOnewayHash('another.email@somecompany.com', 'SFID1');
    expect(first).to.not.equal(second);
    done();
  });
});

import { expect } from 'chai';
import navMiddleware from './nav-middleware';

describe('nav-middleware', () => {
  it('Identifies requests from NAV', () => {
    const req = {
      rawBody: '<test>fakeXML</test>',
    };
    const res = {};
    navMiddleware(req, res, () => {
      expect(req._isNAVRequest).to.equal(true);
    });
  });

  it('will not Identify non NAV requests', () => {
    const req = { };
    const res = {};
    navMiddleware(req, res, () => {
      expect(req._isNAVRequest).to.equal(undefined);
    });
  });
});

import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import { deleteAndCreateAppTestData, deleteAllUsersAndFiles } from '../utils/helpers';

chai.use(chaiHttp);

describe('AppController', () => {
  beforeEach(async () => { await deleteAndCreateAppTestData(); });

  afterEach(async () => { await deleteAllUsersAndFiles(); });

  it('GET /status', (done) => {
    chai.request(app)
      .get('/status')
      .end((err, res) => {
        expect(err).to.equal(null);
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal({ redis: true, db: true });
        done();
      });
  });

  it('GET /stats', (done) => {
    chai.request(app)
      .get('/stats')
      .end(async (err, res) => {
        expect(err).to.equal(null);
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('users');
        expect(res.body).to.have.property('files');
        expect(res.body.users).to.equal(3);
        expect(res.body.files).to.equal(4);
        done();
      });
  });
});

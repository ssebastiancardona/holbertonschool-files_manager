/* js dk */
import crypto from 'crypto';
import { ObjectID } from 'mongodb';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { getRandomInt, credsFromAuthHeaderString, findUserByCreds, deleteAndCreateAuthTestData, deleteAllUsersAndFiles } from '../utils/helpers';

chai.use(chaiHttp);
const requester = chai.request(app).keepOpen();
const randomUserId = getRandomInt(1, 99999999);
const randomPassword = getRandomInt(1, 99999999);
let token;

describe('UsersController', () => {
  beforeEach(async () => { await deleteAndCreateAuthTestData(); });

  afterEach(async () => { await deleteAllUsersAndFiles(); });

  after(() => {
    requester.close();
  });

  it('POST /users with a random new user', (done) => {
    const bodyData = {
      email: `testuser${randomUserId}@email.com`,
      password: `${randomPassword}abcde`,
    };
    requester
      .post('/users')
      .send(bodyData)
      .end(async (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('email');
        expect(res.body).to.have.property('id');
        expect(res.body.email).to.equal(bodyData.email);

        const userArray = await dbClient.users.find({
          _id: ObjectID(res.body.id),
          email: bodyData.email,
        }).toArray();
        const usr = userArray[0];
        const hashedPassword = crypto.createHash('SHA1').update(bodyData.password).digest('hex');
        expect(userArray.length).to.be.greaterThan(0);
        expect(usr.email).to.equal(bodyData.email);
        expect(usr._id.toString()).to.equal(ObjectID(res.body.id).toString());
        expect(usr.password).to.equal(hashedPassword);
        done();
      });
  });

  it('POST /users with user that already exists', (done) => {
    const bodyData = {
      email: 'bob@dylan.com',
      password: 'toto1234!',
    };
    requester
      .post('/users')
      .send(bodyData)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(400);
        expect(res.body.error).to.equal('Already exist');
        done();
      });
  });

  it('POST /users with missing email', (done) => {
    const bodyData = {
      password: `${randomPassword}abcde`,
    };
    requester
      .post('/users')
      .send(bodyData)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(400);
        expect(res.body.error).to.equal('Missing email');
        done();
      });
  });

  it('POST /users with missing password', (done) => {
    const bodyData = {
      email: `testuser${randomUserId}@email.com`,
    };
    requester
      .post('/users')
      .send(bodyData)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(400);
        expect(res.body).to.deep.equal({ error: 'Missing password' });
        done();
      });
  });

  it('GET /users/me with valid user', (done) => {
    const headData = {
      Authorization: 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=',
    };

    requester
      .get('/connect')
      .set(headData)
      .then(async (res) => {
        const creds = await credsFromAuthHeaderString(headData.Authorization);
        const user = await findUserByCreds(creds.email, creds.password);
        token = res.body.token;
        expect(res).to.have.status(200);
        const tokenHeader = { 'X-Token': token };
        requester
          .get('/users/me')
          .set(tokenHeader)
          .then(async (res) => {
            expect(res).to.have.status(200);
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('email');
            expect(res.body.id.length).to.equal(24);
            expect(res.body.id.toString()).to.equal(user._id.toString());
            expect(await redisClient.get(`auth_${token}`)).to.equal(res.body.id);
            expect(res.body.email).to.equal('bob@dylan.com');
            done();
          });
      });
  });

  it('GET /users/me with invalid user', (done) => {
    const headData = { 'X-Token': '031bffac-3edc-4e51-aaae-1c121317da8a' };
    requester
      .get('/users/me')
      .send(headData)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(401);
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
});

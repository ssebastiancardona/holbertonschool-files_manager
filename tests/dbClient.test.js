import { expect } from 'chai';
import { MongoClient, Db } from 'mongodb';
import dbClient from '../utils/db';
import { deleteAllUsersAndFiles } from '../utils/helpers';

describe('dbClient', () => {
  beforeEach(async () => { await deleteAllUsersAndFiles(); });

  afterEach(async () => { await deleteAllUsersAndFiles(); });

  it('checks the properties of dbClient', () => {
    expect(dbClient.host).to.equal(process.env.DB_HOST || 'localhost');
    expect(dbClient.port).to.equal(process.env.DB_PORT || 27017);
    expect(dbClient.dbName).to.equal(process.env.DB_DATABASE || 'files_manager');
    expect(dbClient.client).to.be.instanceOf(MongoClient);
    expect(dbClient.db).to.be.instanceOf(Db);
  });

  it('#isAlive()', () => {
    expect(dbClient.isAlive()).to.equal(true);
  });

  it('#nbUsers()', async () => {
    await dbClient.users.insertMany([
      { email: 'me@me.com' },
      { email: 'me2@me.com' },
    ]);
    expect(await dbClient.nbUsers()).to.equal(2);
  });

  it('#nbFiles()', async () => {
    await dbClient.files.insertMany([
      { name: 'file 1' },
      { name: 'file 2' },
      { name: 'file 3' },
    ]);
    expect(await dbClient.nbFiles()).to.equal(3);
  });
});

/* eslint-disable */
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { ObjectID } from 'mongodb';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import { findUserByCreds, credsFromAuthHeaderString, getRandomInt, deleteAllUsersAndFiles } from '../utils/helpers';
import app from '../server';

chai.use(chaiHttp);
const fPath = process.env.FOLDER_PATH || '/tmp/files_manager';
const headData = { Authorization: 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=' };
const invalidTokenHeader = { 'X-Token': 'f21fb953-16f9-46ed-8d9c-84c6450ec80f' };
const folderTmpFilesManagerPath = process.env.FOLDER_PATH || '/tmp/files_manager';
let userObj;
let fileObj;
let publicFileObj;
let insertedFile;
let insertedUser;
let insertedFileId;
let insertedUserId;
let insertedPublicFile;
let insertedPublicFileId;
let token;
let postHeaders;
let initialFileId = null;
let initialFileContent = null;
let unpublishedOwnedFolderId;
let publishedOwnedFile;
let publishedOwnedFileId;

const fctRandomString = () => {
  return Math.random().toString(36).substring(2, 15);
}
const fctCreateTmp = () => {
  if (!fs.existsSync(folderTmpFilesManagerPath)) {
      fs.mkdirSync(folderTmpFilesManagerPath);
  }
}
const fctRemoveTmp = () => {
  if (fs.existsSync(folderTmpFilesManagerPath)) {
      fs.readdirSync(`${folderTmpFilesManagerPath}/`).forEach((i) => {
          fs.unlinkSync(`${folderTmpFilesManagerPath}/${i}`)
      })
  }
}

describe('FilesController', () => {
  beforeEach(async () => {
    await dbClient.users.deleteMany({}).catch(console.error);
    await dbClient.files.deleteMany({}).catch(console.error);

    userObj = await dbClient.users.insertOne({ email: 'bob@dylan.com', password: '89cad29e3ebc1035b29b1478a8e70854f25fa2b2' });
    [insertedUser] = userObj.ops;
    insertedUserId = userObj.ops[0]._id.toString();

    fileObj = await dbClient.files.insertOne({
      userId: ObjectID(insertedUserId),
      name: 'testFile.txt',
      type: 'file',
      isPublic: false,
      parentId: 0,
    });
    [insertedFile] = fileObj.ops;
    insertedFileId = fileObj.ops[0]._id.toString();

    publicFileObj = await dbClient.files.insertOne({
      userId: ObjectID(insertedUserId),
      name: 'publicTestFile.txt',
      type: 'file',
      isPublic: true,
      parentId: 0,
    });
    [insertedPublicFile] = publicFileObj.ops;
    insertedPublicFileId = publicFileObj.ops[0]._id.toString();

    return new Promise((resolve) => {
      fctRemoveTmp();
      chai.request(app)
        .get('/connect')
        .set(headData)
        .then(async (res) => {
          token = res.body.token;
          postHeaders = { 'X-Token': token };
          expect(res).to.have.status(200);
          fctCreateTmp();
          const fileLocalPath = `${folderTmpFilesManagerPath}/${uuidv4()}`;
          initialFileContent = `Hello-${uuidv4()}`;
          fs.writeFileSync(fileLocalPath, initialFileContent);

          const initialFile = {
              userId: ObjectID(insertedUserId),
              name: fctRandomString(),
              type: "file",
              parentId: '0',
              isPublic: false,
              localPath: fileLocalPath
          };
          const createdFileDocs = await dbClient.files.insertOne(initialFile);
          if (createdFileDocs && createdFileDocs.ops.length > 0) {
              initialFileId = createdFileDocs.ops[0]._id.toString();
          }

          const unpublishedOwnedFolder = await dbClient.files.insertOne({
            userId: ObjectID(insertedUserId),
            name: 'images',
            type: 'folder',
            isPublic: false,
            parentId: 0,
          });
          unpublishedOwnedFolderId = unpublishedOwnedFolder.ops[0]._id.toString();

          const publicFileLocalPath = `${folderTmpFilesManagerPath}/${uuidv4()}`;
          fs.writeFileSync(publicFileLocalPath, 'Hello World!');

          const publicOwnedFile = {
              userId: ObjectID(insertedUserId),
              name: 'publicOwnedFile.txt',
              type: "file",
              parentId: '0',
              isPublic: true,
              localPath: publicFileLocalPath
          };
          const publicOwnedFileDoc = await dbClient.files.insertOne(publicOwnedFile);
          if (publicOwnedFileDoc && publicOwnedFileDoc.ops.length > 0) {
              publishedOwnedFileId = publicOwnedFileDoc.ops[0]._id.toString();
              publishedOwnedFile = publicOwnedFileDoc.ops[0];
          }

          resolve();
        });
    });
  });

  afterEach(async () => { await deleteAllUsersAndFiles(); });

  it('POST /files with valid user', (done) => {
    const bodyData = { name: 'myText.txt', type: 'file', data: 'SGVsbG8gV2Vic3RhY2shCg==' };
    chai.request(app)
      .post('/files')
      .set(postHeaders)
      .send(bodyData)
      .then(async (res) => {
        const creds = await credsFromAuthHeaderString(headData.Authorization);
        const user = await findUserByCreds(creds.email, creds.password);
        const fileArray = await dbClient.files.find(
          { userId: ObjectID(user._id), _id: ObjectID(res.body.id) },
        ).toArray();
        const file = fileArray[0];
        expect(res).to.have.status(201);
        expect(res.body.id.length).to.equal(24);
        expect(res.body.userId).to.equal(user._id.toString());
        expect(res.body.name).to.equal('myText.txt');
        expect(res.body.type).to.equal('file');
        expect(res.body.isPublic).to.equal(false);
        expect(res.body.parentId).to.equal(0);
        expect(fileArray.length).to.equal(1);
        expect(file._id.toString()).to.equal(res.body.id);
        expect(file.userId.toString()).to.equal(user._id.toString());
        expect(file.name).to.equal('myText.txt');
        expect(file.type).to.equal('file');
        expect(file.isPublic).to.equal(false);
        expect(file.parentId).to.equal(0);
        expect(file).to.have.property('localPath');
        expect(file.localPath).to.contain(fPath);
        done();
      });
  });

  it('POST /files with valid user, missing name in request body', (done) => {
    const bodyData = { type: 'file', data: 'SGVsbG8gV2Vic3RhY2shCg==' };
    chai.request(app)
      .post('/files')
      .set(postHeaders)
      .send(bodyData)
      .then((res) => {
        expect(res).to.have.status(400);
        expect(res.body).to.deep.equal({ error: 'Missing name' });
        done();
      });
  });

  it('POST /files with valid user, missing type in request body', (done) => {
    const bodyData = { name: 'myText.txt', data: 'SGVsbG8gV2Vic3RhY2shCg==' };
    chai.request(app)
      .post('/files')
      .set(postHeaders)
      .send(bodyData)
      .then((res) => {
        expect(res).to.have.status(400);
        expect(res.body).to.deep.equal({ error: 'Missing type' });
        done();
      });
  });

  it('POST /files with valid user, missing data in request body and type != folder', (done) => {
    const bodyData = { name: 'myText.txt', type: 'file' };
    chai.request(app)
      .post('/files')
      .set(postHeaders)
      .send(bodyData)
      .then((res) => {
        expect(res).to.have.status(400);
        expect(res.body).to.deep.equal({ error: 'Missing data' });
        done();
      });
  });

  it('POST /files with valid user, parentId is set, parentId file exists and type == folder', (done) => {
    const bodyData = { name: 'images', type: 'folder' };
    chai.request(app)
      .post('/files')
      .set(postHeaders)
      .send(bodyData)
      .then(async (res) => {
        const creds = await credsFromAuthHeaderString(headData.Authorization);
        const user = await findUserByCreds(creds.email, creds.password);
        const parentId = res.body.id;
        const fileArray = await dbClient.files.find(
          { userId: ObjectID(user._id), _id: ObjectID(res.body.id) },
        ).toArray();
        const file = fileArray[0];
        expect(res.statusCode).to.equal(201);
        expect(res.body.id.length).to.equal(24);
        expect(res.body.userId).to.equal(user._id.toString());
        expect(res.body.name).to.equal('images');
        expect(res.body.type).to.equal('folder');
        expect(res.body.isPublic).to.equal(false);
        expect(res.body.parentId).to.equal(0);
        expect(fileArray.length).to.equal(1);
        expect(file._id.toString()).to.equal(res.body.id);
        expect(file.userId.toString()).to.equal(user._id.toString());
        expect(file.name).to.equal('images');
        expect(file.type).to.equal('folder');
        expect(file.isPublic).to.equal(false);
        expect(file.parentId).to.equal(0);

        const bodyData = {
          name: 'myText.txt', type: 'file', data: 'SGVsbG8gV2Vic3RhY2shCg==', parentId,
        };
        chai.request(app)
          .post('/files')
          .set(postHeaders)
          .send(bodyData)
          .then(async (res) => {
            const fileArray = await dbClient.files.find(
              { userId: ObjectID(user._id), _id: ObjectID(res.body.id) },
            ).toArray();
            const file = fileArray[0];
            expect(res.statusCode).to.equal(201);
            expect(res.body.id.length).to.equal(24);
            expect(res.body.userId).to.equal(user._id.toString());
            expect(res.body.name).to.equal('myText.txt');
            expect(res.body.type).to.equal('file');
            expect(res.body.isPublic).to.equal(false);
            expect(res.body.parentId).to.equal(parentId);
            expect(fileArray.length).to.equal(1);
            expect(file._id.toString()).to.equal(res.body.id);
            expect(file.userId.toString()).to.equal(user._id.toString());
            expect(file.name).to.equal('myText.txt');
            expect(file.type).to.equal('file');
            expect(file.isPublic).to.equal(false);
            expect(file.parentId.toString()).to.equal(parentId);
            expect(file).to.have.property('localPath');
            expect(file.localPath).to.contain(fPath);
            done();
          });
      });
  });

  it('POST /files with valid user, parentId is set, parentId file doesn\'t exist', (done) => {
    const parentId = '5f1e881cc7ba06511e683b23';
    const bodyData = {
      name: 'myText.txt', type: 'file', data: 'SGVsbG8gV2Vic3RhY2shCg==', parentId,
    };
    chai.request(app)
      .post('/files')
      .set(postHeaders)
      .send(bodyData)
      .then(async (res) => {
        expect(res).to.have.status(400);
        expect(res.body).to.deep.equal({ error: 'Parent not found' });
        done();
      });
  });

  it('POST /files with valid user, parentId is set, parentId file exists and type != folder', (done) => {
    const bodyData = { name: 'myText.txt', type: 'file', data: 'SGVsbG8gV2Vic3RhY2shCg==' };
    chai.request(app)
      .post('/files')
      .set(postHeaders)
      .send(bodyData)
      .then(async (res) => {
        const creds = await credsFromAuthHeaderString(headData.Authorization);
        const user = await findUserByCreds(creds.email, creds.password);
        const parentId = res.body.id;
        const fileArray = await dbClient.files.find(
          { userId: ObjectID(user._id), _id: ObjectID(res.body.id) },
        ).toArray();
        const file = fileArray[0];
        expect(res.statusCode).to.equal(201);
        expect(res.body.id.length).to.equal(24);
        expect(res.body.userId).to.equal(user._id.toString());
        expect(res.body.name).to.equal('myText.txt');
        expect(res.body.type).to.equal('file');
        expect(res.body.isPublic).to.equal(false);
        expect(res.body.parentId).to.equal(0);
        expect(fileArray.length).to.equal(1);
        expect(file._id.toString()).to.equal(res.body.id);
        expect(file.userId.toString()).to.equal(user._id.toString());
        expect(file.name).to.equal('myText.txt');
        expect(file.type).to.equal('file');
        expect(file.isPublic).to.equal(false);
        expect(file.parentId).to.equal(0);

        const bodyData = {
          name: 'myText.txt', type: 'file', data: 'SGVsbG8gV2Vic3RhY2shCg==', parentId,
        };
        chai.request(app)
          .post('/files')
          .set(postHeaders)
          .send(bodyData)
          .then(async (res) => {
            const fileArray = await dbClient.files.find(
              { userId: ObjectID(user._id), _id: ObjectID(res.body.id) },
            ).toArray();
            expect(res.statusCode).to.equal(400);
            expect(fileArray.length).to.equal(0);
            expect(res.body).to.deep.equal({ error: 'Parent is not a folder' });
            done();
          });
      });
  });

  it('GET /files/:id with valid user, file linked to :id, file linked to userId', (done) => {
    chai.request(app)
      .get(`/files/${insertedFileId}`)
      .set(postHeaders)
      .then((res) => {
        expect(res).to.have.status(200);
        expect(res.body.id).to.equal(insertedFileId);
        expect(res.body.userId).to.equal(insertedUserId);
        expect(res.body.name).to.equal('testFile.txt');
        expect(res.body.type).to.equal('file');
        expect(res.body.isPublic).to.be.false;
        expect(res.body.parentId).to.equal(0);
        done();
      });
  });

  it('GET /files/:id with invalid token', (done) => {
    chai.request(app)
      .get(`/files/${insertedFileId}`)
      .set(invalidTokenHeader)
      .then(async (res) => {
        expect(res).to.have.status(401);
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });

  it('GET /files/:id with valid user, no file linked to :id', (done) => {
    chai.request(app)
      .get('/files/5f1e8896c7ba06511e683b25')
      .set(postHeaders)
      .then((res) => {
        expect(res).to.have.status(404);
        expect(res.body.error).to.equal('Not found');
        done();
      });
  });

  it('GET /files/:id with valid user, file linked to :id, no file linked to userId', async () => {
    let randomNewFolderId;
    const randomNewFolder = {
      userId: new ObjectID(),
      name: 'randomNewFolder',
      type: 'folder',
      parentId: '0',
    };
    const createdFileDocs = await dbClient.files.insertOne(randomNewFolder);
    if (createdFileDocs && createdFileDocs.ops.length > 0) {
      randomNewFolderId = createdFileDocs.ops[0]._id.toString();
    }

    chai.request(app)
      .get(`/files/${randomNewFolderId}`)
      .set(postHeaders)
      .then((res) => {
        expect(res).to.have.status(404);
        expect(res.body.error).to.equal('Not found');
      });
  });

  it('GET /files with valid user, parentId === 0 and no page', (done) => {
    const addedFiles = [];
    const insertFiles = async () => {
      await dbClient.files.deleteMany({});
      for (let i = 0; i < 22; i += 1) {
        const randomFileName = `${getRandomInt(1, 99999999)}.txt`;
        const item = {
          userId: ObjectID(insertedUserId),
          name: randomFileName,
          type: 'folder',
          parentId: '0',
        };
        const createdFileDocs = await dbClient.files.insertOne(item);
        if (createdFileDocs && createdFileDocs.ops.length > 0) {
          item.id = createdFileDocs.ops[0]._id.toString();
        }
        addedFiles.push(item);
      }
    };
    insertFiles().then(() => {
      chai.request(app)
        .get('/files')
        .set(postHeaders)
        .then((res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.length(20);
          expect(res.body[0].id).to.equal(addedFiles[0].id);
          expect(res.body[0].userId.toString()).to.equal(addedFiles[0].userId.toString());
          expect(res.body[0].name).to.equal(addedFiles[0].name);
          expect(res.body[0].type).to.equal(addedFiles[0].type);
          expect(res.body[0].parentId.toString()).to.equal(addedFiles[0].parentId.toString());
          expect(res.body[13].id).to.equal(addedFiles[13].id);
          expect(res.body[19].id).to.equal(addedFiles[19].id);
          done();
        });
    });
  });

  it('GET /files with valid user, with a wrong parentId and no page', (done) => {
    const addedFiles = [];
    const randomFileName = `${getRandomInt(1, 99999999)}.txt`;
    const insertFiles = async () => {
      await dbClient.files.deleteMany({});
      for (let i = 0; i < 22; i += 1) {
        const item = {
          userId: ObjectID(insertedUserId),
          name: randomFileName,
          type: 'folder',
          parentId: 0,
        };
        const createdFileDocs = await dbClient.files.insertOne(item);
        if (createdFileDocs && createdFileDocs.ops.length > 0) {
          item.id = createdFileDocs.ops[0]._id.toString();
        }
        addedFiles.push(item);
      }
    };
    insertFiles().then(() => {
      chai.request(app)
        .get('/files')
        .set(postHeaders)
        .query({ parentId: new ObjectID().toString() })
        .then((res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.length(0);
          done();
        });
    });
  });

  it('GET /files with valid user, with a valid parentId and no page', (done) => {
    const addedFiles = [];
    let newFolder;
    let newFolderId;
    const insertFiles = async () => {
      const item = {
        userId: ObjectID(insertedUserId),
        name: 'newFolder',
        type: 'folder',
        parentId: 0,
      };
      const newFolderDoc = await dbClient.files.insertOne(item);
      if (newFolderDoc && newFolderDoc.ops.length > 0) {
        [newFolder] = newFolderDoc.ops;
        newFolderId = newFolderDoc.ops[0]._id.toString();
      }
      for (let i = 0; i < 22; i += 1) {
        const randomFileName = `${getRandomInt(1, 99999999)}.txt`;
        const item = {
          userId: ObjectID(insertedUserId),
          name: randomFileName,
          type: 'folder',
          parentId: ObjectID(newFolderId),
        };
        const createdFileDocs = await dbClient.files.insertOne(item);
        if (createdFileDocs && createdFileDocs.ops.length > 0) {
          item.id = createdFileDocs.ops[0]._id.toString();
        }
        addedFiles.push(item);
      }
    };
    insertFiles().then(() => {
      chai.request(app)
        .get('/files')
        .set(postHeaders)
        .then((res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.length(20);
          expect(res.body[5].id).to.equal(newFolderId);
          expect(res.body[5].userId.toString()).to.equal(newFolder.userId.toString());
          expect(res.body[5].name).to.equal(newFolder.name);
          expect(res.body[5].type).to.equal(newFolder.type);
          expect(res.body[5].parentId.toString()).to.equal(newFolder.parentId.toString());
          expect(res.body[6].id).to.equal(addedFiles[0].id);
          expect(res.body[6].userId.toString()).to.equal(addedFiles[0].userId.toString());
          expect(res.body[6].name).to.equal(addedFiles[0].name);
          expect(res.body[6].type).to.equal(addedFiles[0].type);
          expect(res.body[6].parentId.toString()).to.equal(addedFiles[0].parentId.toString());
          done();
        });
    });
  });

  it('GET /files with valid user, parentId === 0, with pagination', (done) => {
    const addedFiles = [];
    const insertFiles = async () => {
      await dbClient.files.deleteMany({});
      for (let i = 0; i < 22; i += 1) {
        const randomFileName = `${getRandomInt(1, 99999999)}.txt`;
        const item = {
          userId: ObjectID(insertedUserId),
          name: randomFileName,
          type: 'folder',
          parentId: '0',
        };
        const createdFileDocs = await dbClient.files.insertOne(item);
        if (createdFileDocs && createdFileDocs.ops.length > 0) {
          item.id = createdFileDocs.ops[0]._id.toString();
        }
        addedFiles.push(item);
      }
    };
    insertFiles().then(() => {
      chai.request(app)
        .get('/files')
        .set(postHeaders)
        .query({ page: 1 })
        .then((res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.length(2);
          expect(res.body[0].id).to.equal(addedFiles[20].id);
          expect(res.body[0].userId.toString()).to.equal(addedFiles[20].userId.toString());
          expect(res.body[0].name).to.equal(addedFiles[20].name);
          expect(res.body[0].type).to.equal(addedFiles[20].type);
          expect(res.body[0].parentId.toString()).to.equal(addedFiles[20].parentId.toString());
          expect(res.body[1].id).to.equal(addedFiles[21].id);
          done();
        });
    });
  });

  it('GET /files with valid user, parentId === 0, with pagination past total results requested', (done) => {
    const addedFiles = [];
    const insertFiles = async () => {
      await dbClient.files.deleteMany({});
      for (let i = 0; i < 22; i += 1) {
        const randomFileName = `${getRandomInt(1, 99999999)}.txt`;
        const item = {
          userId: ObjectID(insertedUserId),
          name: randomFileName,
          type: 'folder',
          parentId: '0',
        };
        const createdFileDocs = await dbClient.files.insertOne(item);
        if (createdFileDocs && createdFileDocs.ops.length > 0) {
          item.id = createdFileDocs.ops[0]._id.toString();
        }
        addedFiles.push(item);
      }
    };
    insertFiles().then(() => {
      chai.request(app)
        .get('/files')
        .set(postHeaders)
        .query({ page: 13 })
        .then((res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.length(0);
          done();
        });
    });
  });

  it('GET /files with invalid user', (done) => {
    chai.request(app)
      .get('/files')
      .set(invalidTokenHeader)
      .then(async (res) => {
        expect(res).to.have.status(401);
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });

  it('PUT /files/:id/publish invalid token', (done) => {
    chai.request(app)
      .put(`/files/${insertedFileId}/publish`)
      .set(invalidTokenHeader)
      .then(async (res) => {
        expect(res).to.have.status(401);
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });

  it('PUT /files/:id/publish with no file linked to :id', (done) => {
    chai.request(app)
      .put('/files/5f1e8896c7ba06511e683b25/publish')
      .set(postHeaders)
      .then((res) => {
        expect(res).to.have.status(404);
        expect(res.body.error).to.equal('Not found');
        done();
      });
  });

  it('PUT /files/:id/publish with no file linked to :id for this user', async () => {
    let randomNewFolderId;
    const randomNewFolder = {
      userId: new ObjectID(),
      name: 'randomNewFolder',
      type: 'folder',
      parentId: '0',
    };
    const createdFileDocs = await dbClient.files.insertOne(randomNewFolder);
    if (createdFileDocs && createdFileDocs.ops.length > 0) {
      randomNewFolderId = createdFileDocs.ops[0]._id.toString();
    }

    chai.request(app)
      .put(`/files/${randomNewFolderId}/publish`)
      .set(postHeaders)
      .then((res) => {
        expect(res).to.have.status(404);
        expect(res.body.error).to.equal('Not found');
      });
  });

  it('PUT /files/:id/publish with correct :id of the owner - file not published yet', (done) => {
    chai.request(app)
      .put(`/files/${insertedFileId}/publish`)
      .set(postHeaders)
      .end(async (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(200);

        const file = res.body;
        expect(file.id).to.equal(insertedFileId);
        expect(file.userId).to.equal(insertedUserId);
        expect(file.name).to.equal(insertedFile.name);
        expect(file.type).to.equal(insertedFile.type);
        expect(file.isPublic).to.be.true;
        const updatedFileArray = await dbClient.files.find(ObjectID(file.id)).toArray();
        const updatedFile = updatedFileArray[0];
        expect(updatedFile.isPublic).to.be.true;
        done();
      });
  });

  it('PUT /files/:id/publish with correct :id of the owner - file already published', (done) => {
    chai.request(app)
      .put(`/files/${insertedPublicFileId}/publish`)
      .set(postHeaders)
      .end(async (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(200);

        const file = res.body;
        expect(file.id).to.equal(insertedPublicFileId);
        expect(file.userId).to.equal(insertedUserId);
        expect(file.name).to.equal(insertedPublicFile.name);
        expect(file.type).to.equal(insertedPublicFile.type);
        expect(file.isPublic).to.be.true;
        const updatedFileArray = await dbClient.files.find(ObjectID(file.id)).toArray();
        const updatedFile = updatedFileArray[0];
        expect(updatedFile.isPublic).to.be.true;
        done();
      });
  });

  it('PUT /files/:id/unpublish invalid token', (done) => {
    chai.request(app)
      .put(`/files/${insertedFileId}/unpublish`)
      .set(invalidTokenHeader)
      .then(async (res) => {
        expect(res).to.have.status(401);
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });

  it('PUT /files/:id/unpublish with no file linked to :id', (done) => {
    chai.request(app)
      .put('/files/5f1e8896c7ba06511e683b25/unpublish')
      .set(postHeaders)
      .then((res) => {
        expect(res).to.have.status(404);
        expect(res.body.error).to.equal('Not found');
        done();
      });
  });

  it('PUT /files/:id/unpublish with no file linked to :id for this user', async () => {
    let randomNewFolderId;
    const randomNewFolder = {
      userId: new ObjectID(),
      name: 'randomNewFolder',
      type: 'folder',
      parentId: '0',
    };
    const createdFileDocs = await dbClient.files.insertOne(randomNewFolder);
    if (createdFileDocs && createdFileDocs.ops.length > 0) {
      randomNewFolderId = createdFileDocs.ops[0]._id.toString();
    }

    chai.request(app)
      .put(`/files/${randomNewFolderId}/unpublish`)
      .set(postHeaders)
      .then((res) => {
        expect(res).to.have.status(404);
        expect(res.body.error).to.equal('Not found');
      });
  });

  it('PUT /files/:id/unpublish with correct :id of the owner - file not published yet', (done) => {
    chai.request(app)
      .put(`/files/${insertedFileId}/unpublish`)
      .set(postHeaders)
      .end(async (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(200);

        const file = res.body;
        expect(file.id).to.equal(insertedFileId);
        expect(file.userId).to.equal(insertedUserId);
        expect(file.name).to.equal(insertedFile.name);
        expect(file.type).to.equal(insertedFile.type);
        expect(file.isPublic).to.be.false;
        const updatedFileArray = await dbClient.files.find(ObjectID(file.id)).toArray();
        const updatedFile = updatedFileArray[0];
        expect(updatedFile.isPublic).to.be.false;
        done();
      });
  });

  it('PUT /files/:id/unpublish with correct :id of the owner - file already published', (done) => {
    chai.request(app)
      .put(`/files/${insertedPublicFileId}/unpublish`)
      .set(postHeaders)
      .end(async (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(200);

        const file = res.body;
        expect(file.id).to.equal(insertedPublicFileId);
        expect(file.userId).to.equal(insertedUserId);
        expect(file.name).to.equal(insertedPublicFile.name);
        expect(file.type).to.equal(insertedPublicFile.type);
        expect(file.isPublic).to.be.false;
        const updatedFileArray = await dbClient.files.find(ObjectID(file.id)).toArray();
        const updatedFile = updatedFileArray[0];
        expect(updatedFile.isPublic).to.be.false;
        done();
      });
  });

  it('GET /files/:id/data with no file linked to :id', (done) => {
    chai.request(app)
      .get('/files/5f1e8896c7ba06511e683b25/data')
      .set(postHeaders)
      .then((res) => {
        expect(res).to.have.status(404);
        expect(res.body.error).to.equal('Not found');
        done();
      });
  });

  it('GET /files/:id/data with an unpublished file linked to :id but user unauthenticated', (done) => {
    chai.request(app)
      .get(`/files/${insertedFileId}/data`)
      .set(invalidTokenHeader)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
        done();
      });
  });

  it('GET /files/:id/data with an unpublished file linked to :id but user authenticated and not owner', async () => {
    const unownedFileObj = await dbClient.files.insertOne({
      userId: new ObjectID(),
      name: 'unownedTestFile.txt',
      type: 'file',
      isPublic: false,
      parentId: 0,
    });
    const [unownedInsertedFile] = unownedFileObj.ops;
    const unownedInsertedFileId = unownedFileObj.ops[0]._id.toString();
    chai.request(app)
      .get(`/files/${unownedInsertedFileId}/data`)
      .set(postHeaders)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
      });
  });

  it('GET /files/:id/data with an unpublished file linked to :id and user authenticated and owner', (done) => {
    chai.request(app)
      .get(`/files/${initialFileId}/data`)
      .set(postHeaders)
      .buffer()
      .parse((res, cb) => {
          res.setEncoding("binary");
          res.data = "";
          res.on("data", (chunk) => {
              res.data += chunk;
          });
          res.on("end", () => {
              cb(null, new Buffer.from(res.data, "binary"));
          });
      })
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(200);
        expect(res.body.toString()).to.equal(initialFileContent);
        done();
      });
  });

  it('GET /files/:id/data with a published file linked to :id and user unauthenticated', (done) => {
    chai.request(app)
      .get(`/files/${insertedPublicFileId}/data`)
      .set(invalidTokenHeader)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
        done();
      });
  });

  it('GET /files/:id/data with a published file linked to :id and user authenticated but not owner', async () => {
    const unownedFileObj = await dbClient.files.insertOne({
      userId: new ObjectID(),
      name: 'unownedTestFile.txt',
      type: 'file',
      isPublic: true,
      parentId: 0,
    });
    const unownedInsertedFileId = unownedFileObj.ops[0]._id.toString();
    chai.request(app)
      .get(`/files/${unownedInsertedFileId}/data`)
      .set(postHeaders)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
      });
  });

  it('GET /files/:id/data with a published file linked to :id and user authenticated and owner', (done) => {
    chai.request(app)
      .get(`/files/${publishedOwnedFileId}/data`)
      .set(postHeaders)
      .buffer()
      .parse((res, cb) => {
          res.setEncoding("binary");
          res.data = "";
          res.on("data", (chunk) => {
              res.data += chunk;
          });
          res.on("end", () => {
              cb(null, new Buffer.from(res.data, "binary"));
          });
      })
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(200);
        expect(res.body.toString()).to.equal('Hello World!');
        done();
      });
  });

  it('GET /files/:id/data with an unpublished folder linked to :id but user unauthenticated', async () => {
    const unownedFileObj = await dbClient.files.insertOne({
      userId: new ObjectID(),
      name: 'images',
      type: 'folder',
      isPublic: false,
      parentId: 0,
    });
    const unownedInsertedFileId = unownedFileObj.ops[0]._id.toString();
    chai.request(app)
      .get(`/files/${unownedInsertedFileId}/data`)
      .set(invalidTokenHeader)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
      });
  });

  it('GET /files/:id/data with an unpublished folder linked to :id but user authenticated and not owner', async () => {
    const unownedFileObj = await dbClient.files.insertOne({
      userId: new ObjectID(),
      name: 'images',
      type: 'folder',
      isPublic: false,
      parentId: 0,
    });
    const unownedInsertedFileId = unownedFileObj.ops[0]._id.toString();
    chai.request(app)
      .get(`/files/${unownedInsertedFileId}/data`)
      .set(postHeaders)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
      });
  });

  it('GET /files/:id/data with an unpublished folder linked to :id and user authenticated and owner', (done) => {
    chai.request(app)
      .get(`/files/${unpublishedOwnedFolderId}/data`)
      .set(postHeaders)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(400);
        expect(res.body.error).to.equal('A folder doesn\'t have content');
        done();
      });
  });

  it('GET /files/:id/data with an unpublished file not present locally linked to :id and user unauthenticated', (done) => {
    chai.request(app)
      .get(`/files/${insertedFileId}/data`)
      .set(invalidTokenHeader)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
        done();
      });
  });

  it('GET /files/:id/data with an unpublished file not present locally linked to :id and user authenticated but not owner', async () => {
    const unownedFileObj = await dbClient.files.insertOne({
      userId: new ObjectID(),
      name: 'unownedTestFile.txt',
      type: 'file',
      isPublic: false,
      parentId: 0,
    });
    const unownedInsertedFileId = unownedFileObj.ops[0]._id.toString();
    chai.request(app)
      .get(`/files/${unownedInsertedFileId}/data`)
      .set(postHeaders)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
      });
  });

  it('GET /files/:id/data with an unpublished file not present locally linked to :id and user authenticated and owner', (done) => {
    chai.request(app)
      .get(`/files/${insertedFileId}/data`)
      .set(postHeaders)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({ error: 'Not found' });
        done();
      });
  });
});

import crypto from 'crypto';
import { ObjectID } from 'mongodb';
import fs from 'fs';
import mime from 'mime-types';
import redisClient from './redis';
import dbClient from './db';

function getRandomInt(min, max) {
  const minCeil = Math.ceil(min);
  const maxFloor = Math.floor(max);
  return Math.floor(Math.random() * (maxFloor - minCeil) + minCeil);
}

async function checkAuth(request) {
  const tok = request.headers['x-token'];
  const keys = `auth_${tok}`;
  const userId = await redisClient.get(keys);
  return userId || null;
}

async function findFile(request, response, files, userId) {
  const fileId = request.params.id;
  let fileArray;
  if (userId !== 'null') {
    fileArray = await files.find({ _id: ObjectID(fileId) }).toArray();
  } else {
    fileArray = await files.find(
      { userId: ObjectID(userId), _id: ObjectID(fileId) },
    ).toArray();
  }
  return fileArray.length > 0 ? fileArray[0] : null;
}

async function sanitizeReturnObj(response, file, userId) {
  return response.json({
    id: file._id,
    userId,
    name: file.name,
    type: file.type,
    isPublic: file.isPublic,
    parentId: file.parentId,
  });
}

async function findAndUpdateFile(request, response, files, userId, isPublic) {
  const fileId = request.params.id;
  await findFile(request, response, files, userId);
  await files.updateOne(
    { userId: ObjectID(userId), _id: ObjectID(fileId) },
    { $set: { isPublic } },
  );
  return findFile(request, response, files, userId);
}

async function aggregateAndPaginate(response, files, page, searcherTerm, searcherValue) {
  let folderArray;
  if (searcherTerm === 'userId') {
    folderArray = await files.aggregate([
      { $match: { userId: ObjectID(searcherValue) } },
      { $skip: page * 20 },
      { $limit: 20 },
    ]).toArray();
  } else if (searcherTerm === 'parentId') {
    folderArray = await files.aggregate([
      { $match: { parentId: ObjectID(searcherValue) } },
      { $skip: page * 20 },
      { $limit: 20 },
    ]).toArray();
  }
  if (folderArray.length === 0) return response.json([]);
  const mappedFolderArray = folderArray.map((file) => ({
    id: file._id,
    userId: file.userId,
    name: file.name,
    type: file.type,
    isPublic: file.isPublic,
    parentId: file.parentId,
  }));
  return response.json(mappedFolderArray);
}

async function findUserById(userId) {
  const userExistsArray = await dbClient.users.find(`ObjectId("${userId}")`).toArray();
  return userExistsArray[0] || null;
}

async function checkAuthReturnKey(request) {
  const token = request.headers['x-token'];
  const keys = `auth_${token}`;
  const userId = await redisClient.get(keys);
  return userId ? keys : null;
}

async function findUserByCreds(email, hashedPassword) {
  const userExistsArray = await dbClient.users.find({ email, password: hashedPassword }).toArray();
  return userExistsArray.length === 0 ? null : userExistsArray[0];
}

async function credsFromBasicAuth(request) {
  const fullAuthHeader = request.headers.authorization;
  const b64AuthHeader = fullAuthHeader.slice(6);
  const userCreds = Buffer.from(b64AuthHeader, 'base64').toString();
  if (!userCreds.includes(':')) return null;
  const email = userCreds.split(':')[0];
  const password = userCreds.split(':')[1];
  const hashedPassword = crypto.createHash('SHA1').update(password).digest('hex');
  return { email, password: hashedPassword };
}

async function checkFileAndReadContents(response, file, token, userId, size) {
  if (!file.isPublic && userId === null) return response.status(404).json({ error: 'Not found' });
  if (!file.isPublic && file.userId.toString() !== userId.toString()) return response.status(404).json({ error: 'Not found' });
  if (file.type === 'folder') return response.status(400).json({ error: 'A folder doesn\'t have content' });
  if (!fs.existsSync(file.localPath)) return response.status(404).json({ error: 'Not found' });
  const mimeType = mime.lookup(file.name);
  response.setHeader('Content-Type', mimeType);
  let data;
  if (size) {
    data = await fs.promises.readFile(`${file.localPath}_${size}`);
  } else {
    data = await fs.promises.readFile(file.localPath);
  }
  if (data) { return response.end(data); }
  return response.status(404).json({ error: 'Not found' });
}

async function credsFromAuthHeaderString(fullAuthHeader) {
  const b64AuthHeader = fullAuthHeader.slice(6);
  const userCreds = Buffer.from(b64AuthHeader, 'base64').toString();
  const email = userCreds.split(':')[0];
  const password = userCreds.split(':')[1];
  const hashedPassword = crypto.createHash('SHA1').update(password).digest('hex');
  return { email, password: hashedPassword };
}

async function getFileCheckAuth(request) {
  const token = request.headers['x-token'];
  const keys = `auth_${token}`;
  const userId = await redisClient.get(keys);
  return userId || null;
}

async function deleteAndCreateAppTestData() {
  await dbClient.users.deleteMany({}).catch(console.error);
  await dbClient.files.deleteMany({}).catch(console.error);
  await dbClient.users.insertMany([
    { email: 'me@me.com' },
    { email: 'me2@me.com' },
    { email: 'bob@dylan.com', password: '89cad29e3ebc1035b29b1478a8e70854f25fa2b2' },
  ]);
  await dbClient.files.insertMany([
    { name: 'file 1' },
    { name: 'file 2' },
    { name: 'file 3' },
    { name: 'file 4' },
  ]);
}

async function deleteAndCreateAuthTestData() {
  await dbClient.users.deleteMany({}).catch(console.error);
  await dbClient.files.deleteMany({}).catch(console.error);
  await dbClient.users.insertOne({ email: 'bob@dylan.com', password: '89cad29e3ebc1035b29b1478a8e70854f25fa2b2' });
}

async function deleteAllUsersAndFiles() {
  await dbClient.users.deleteMany({});
  await dbClient.files.deleteMany({});
}

export {
  getRandomInt,
  checkAuth,
  findFile,
  sanitizeReturnObj,
  findAndUpdateFile,
  aggregateAndPaginate,
  findUserById,
  checkAuthReturnKey,
  findUserByCreds,
  credsFromBasicAuth,
  checkFileAndReadContents,
  credsFromAuthHeaderString,
  getFileCheckAuth,
  deleteAndCreateAppTestData,
  deleteAndCreateAuthTestData,
  deleteAllUsersAndFiles,
};

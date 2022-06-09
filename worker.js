import Queue from 'bull';
import { ObjectID } from 'mongodb';
import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');
const userQueue = new Queue('userQueue');

fileQueue.process(async (job, done) => {
  if (!job.data.fileId) throw new Error('Missing fileId');
  if (!job.data.userId) throw new Error('Missing userId');

  const files = dbClient.db.collection('files');
  const fileArray = await files.find(
    { userId: ObjectID(job.data.userId), _id: ObjectID(job.data.fileId) },
  ).toArray();
  if (fileArray.length === 0) throw new Error('File not found');

  const fil = fileArray[0];
  try {
    const thumbnail100 = await imageThumbnail(`${fil.name}`, { width: 100, responseType: 'base64' });
    const thumbnail250 = await imageThumbnail(`${fil.name}`, { width: 250, responseType: 'base64' });
    const thumbnail500 = await imageThumbnail(`${fil.name}`, { width: 500, responseType: 'base64' });
    await fs.promises.writeFile(`${fil.localPath}_100`, thumbnail100, 'base64');
    await fs.promises.writeFile(`${fil.localPath}_250`, thumbnail250, 'base64');
    await fs.promises.writeFile(`${fil.localPath}_500`, thumbnail500, 'base64');
  } catch (error) {
    console.error(error);
  }

  done();
});

userQueue.process(async (job, done) => {
  if (!job.data.userId) throw new Error('Missing userId');

  const users = dbClient.db.collection('users');
  const userArray = await users.find({ _id: ObjectID(job.data.userId) }).toArray();
  if (userArray.length === 0) throw new Error('User not found');

  const user = userArray[0];
  console.log(`Welcome ${user.email}!`);

  done();
});

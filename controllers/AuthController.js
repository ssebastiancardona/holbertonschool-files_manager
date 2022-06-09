import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import getIdAndKey from '../utils/users';

class AuthController {
  static async getConnect(req, res) {
    const Authorizations = req.header('Authorization') || '';

    const creds = Authorizations.split(' ')[1];
    if (!creds) return res.status(401).send({ error: 'Unauthorized' });

    const decodedCreds = Buffer.from(creds, 'base64').toString('utf-8');

    const [email, pass] = decodedCreds.split(':');
    if (!email || !pass) return res.status(401).send({ error: 'Unauthorized' });

    const secPass = sha1(pass);

    const user = await dbClient.users.findOne({
      email,
      password: secPass,
    });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const tok = uuidv4();
    const keys = `auth_${tok}`;
    const exp = 24 * 3600;

    await redisClient.set(keys, user._id.toString(), exp);

    return res.status(200).send({ tok });
  }

  static async getDisconnect(req, res) {
    const { userId, key } = await getIdAndKey(req);

    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    await redisClient.del(key);

    return res.status(204).send();
  }
}

export default AuthController;

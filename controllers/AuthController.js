import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import { checkAuthReturnKey, findUserByCreds, credsFromBasicAuth } from '../utils/helpers';

class AuthController {
  static async getConnect(request, response) {
    const creds = await credsFromBasicAuth(request);
    if (!creds) return response.status(401).json({ error: 'Unauthorized' });
    const user = await findUserByCreds(creds.email, creds.password);
    if (!user) return response.status(401).json({ error: 'Unauthorized' });
    const toke = uuidv4();
    const k = `auth_${toke}`;
    await redisClient.set(k, user._id.toString(), 60 * 60 * 24);
    return response.json({ toke });
  }

  static async getDisconnect(request, response) {
    const k = await checkAuthReturnKey(request);
    if (!k) return response.status(401).json({ error: 'Unauthorized' });
    await redisClient.del(k);
    return response.status(204).end();
  }
}

export default AuthController;

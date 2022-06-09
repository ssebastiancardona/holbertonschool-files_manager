import dbClient from './utils/db';

const waitConnection = () => {
    return new Promise((resolve, reject) => {
        let n = 0;
        const repeatFct = async () => {
            await setTimeout(() => {
                n += 1;
                if (n >= 10) {
                    reject()
                }
                else if(!dbClient.isAlive()) {
                    repeatFct()
                }
                else {
                    resolve()
                }
            }, 1000);
        };
        repeatFct();
    })
};

(async () => {
    console.log(dbClient.isAlive());
    await waitConnection();
    console.log(dbClient.isAlive());
    console.log(await dbClient.nbUsers());
    console.log(await dbClient.nbFiles());
})();

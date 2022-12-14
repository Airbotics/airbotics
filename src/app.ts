import express, { Request, Response, NextFunction } from 'express';
import hpp from 'hpp';
import helmet from 'helmet';
import schedule from 'node-schedule';
import config from '@airbotics-config'
import { logger } from '@airbotics-core/logger';
import adminAccount from '@airbotics-modules/admin/account';
import adminImage from '@airbotics-modules/admin/image';
import adminProvision from '@airbotics-modules/admin/provision';
import adminRobot from '@airbotics-modules/admin/robot';
import adminRollout from '@airbotics-modules/admin/rollout';
import adminTeam from '@airbotics-modules/admin/team';
import adminGroup from '@airbotics-modules/admin/group';
import treehub from '@airbotics-modules/treehub';
import imageRepo from '@airbotics-modules/image-repo';
import directorRepo from '@airbotics-modules/director-repo';
import robot from '@airbotics-modules/robot';



const app = express();

app.use(helmet());
app.use(hpp());
app.use(express.json({ limit: config.MAX_JSON_REQUEST_SIZE }));

// log which endpoints are hit, will only log in development
app.use((req, res, next) => {
    logger.debug(`${req.method} - ${req.originalUrl}`);
    next();
});


// health check
app.get('/', (req, res) => {
    return res.status(200).send('Welcome to the Airbotics API');
});


// mount modules
app.use('/api/v0/admin', adminAccount);
app.use('/api/v0/admin', adminImage);
app.use('/api/v0/admin', adminProvision);
app.use('/api/v0/admin', adminRobot);
app.use('/api/v0/admin', adminRollout);
app.use('/api/v0/admin', adminTeam);
app.use('/api/v0/admin', adminGroup);
app.use('/api/v0/robot', robot);
app.use('/api/v0/robot/director', directorRepo);
app.use('/api/v0/robot/repo', imageRepo);
app.use('/api/v0/treehub', treehub);
app.use('/api/v0/robot/treehub', treehub);


// optionally mount a background worker in this process, if it has been configured
// if(config.USE_NODE_SCHEDULER) {
//     schedule.scheduleJob(config.WORKER_CRON, backgroundWorker);
// }

// handle 404
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.warn(`404 - ${req.method} - ${req.originalUrl}`);
    return res.status(404).end();
});


// handle 500
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('500');
    logger.error(err);
    return res.status(500).end();
});


export default app;
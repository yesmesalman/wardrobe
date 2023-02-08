import Sequelize from 'sequelize';
import { default as db } from './../config/database.js';

const Device = db.define('devices', {
    id: {
        type: Sequelize.BIGINT,
        primaryKey: true
    },
    unique_id: {
        type: Sequelize.STRING
    },
});

export default Device;
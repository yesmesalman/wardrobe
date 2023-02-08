import Sequelize from 'sequelize';
import { default as db } from './../config/database.js';

const Device = db.define('devices', {
    id: {
        type: Sequelize.INTEGER(11),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    uniqueId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    apiLevel: {
        type: Sequelize.STRING
    },
    applicationName: {
        type: Sequelize.STRING
    },
    baseOs: {
        type: Sequelize.STRING
    },
    buildId: {
        type: Sequelize.STRING
    },
    batteryLevel: {
        type: Sequelize.STRING
    },
    bootloader: {
        type: Sequelize.STRING
    },
    brand: {
        type: Sequelize.STRING
    },
    buildNumber: {
        type: Sequelize.STRING
    },
    bundleId: {
        type: Sequelize.STRING
    },
    isCameraPresent: {
        type: Sequelize.STRING
    },
    carrier: {
        type: Sequelize.STRING
    },
    codename: {
        type: Sequelize.STRING
    },
    device: {
        type: Sequelize.STRING
    },
    deviceId: {
        type: Sequelize.STRING
    },
    deviceType: {
        type: Sequelize.STRING
    },
    display: {
        type: Sequelize.STRING
    },
    deviceName: {
        type: Sequelize.STRING
    },
    deviceToken: {
        type: Sequelize.STRING
    },
    firstInstallTime: {
        type: Sequelize.STRING
    },
    fontScale: {
        type: Sequelize.STRING
    },
    freeDiskStorage: {
        type: Sequelize.STRING
    },
    freeDiskStorageOld: {
        type: Sequelize.STRING
    },
    hardware: {
        type: Sequelize.STRING
    },
    host: {
        type: Sequelize.STRING
    },
    ipAddress: {
        type: Sequelize.STRING
    },
    incremental: {
        type: Sequelize.STRING
    },
    installerPackageName: {
        type: Sequelize.STRING
    },
    installReferrer: {
        type: Sequelize.STRING
    },
    instanceId: {
        type: Sequelize.STRING
    },
    lastUpdateTime: {
        type: Sequelize.STRING
    },
    macAddress: {
        type: Sequelize.STRING
    },
    manufacturer: {
        type: Sequelize.STRING
    },
    maxMemory: {
        type: Sequelize.STRING
    },
    model: {
        type: Sequelize.STRING
    },
    phoneNumber: {
        type: Sequelize.STRING
    },
    product: {
        type: Sequelize.STRING
    },
    previewSdkInt: {
        type: Sequelize.STRING
    },
    readableVersion: {
        type: Sequelize.STRING
    },
    serialNumber: {
        type: Sequelize.STRING
    },
    securityPatch: {
        type: Sequelize.STRING
    },
    systemName: {
        type: Sequelize.STRING
    },
    systemVersion: {
        type: Sequelize.STRING
    },
    tags: {
        type: Sequelize.STRING
    },
    type: {
        type: Sequelize.STRING
    },
    androidId: {
        type: Sequelize.STRING
    },
    totalDiskCapacity: {
        type: Sequelize.STRING
    },
    totalDiskCapacityOld: {
        type: Sequelize.STRING
    },
    totalMemory: {
        type: Sequelize.STRING
    },
    usedMemory: {
        type: Sequelize.STRING
    },
    userAgent: {
        type: Sequelize.STRING
    },
    userAgentSync: {
        type: Sequelize.STRING
    },
    version: {
        type: Sequelize.STRING
    },
    brightness: {
        type: Sequelize.STRING
    },
    hasGms: {
        type: Sequelize.STRING
    },
    hasHms: {
        type: Sequelize.STRING
    },
    hasNotch: {
        type: Sequelize.STRING
    },
    hasDynamicIsland: {
        type: Sequelize.STRING
    },
    hasSystemFeature: {
        type: Sequelize.STRING
    },
    isAirplaneMode: {
        type: Sequelize.STRING
    },
    isBatteryCharging: {
        type: Sequelize.STRING
    },
    isEmulator: {
        type: Sequelize.STRING
    },
    isKeyboardConnected: {
        type: Sequelize.STRING
    },
    isLandscape: {
        type: Sequelize.STRING
    },
    isLocationEnabled: {
        type: Sequelize.STRING
    },
    isMouseConnected: {
        type: Sequelize.STRING
    },
    isHeadphonesConnected: {
        type: Sequelize.STRING
    },
    isPinOrFingerprintSet: {
        type: Sequelize.STRING
    },
    isTablet: {
        type: Sequelize.STRING
    },
    isTabletMode: {
        type: Sequelize.STRING
    },
    syncUniqueId: {
        type: Sequelize.STRING
    },
}, {
    indexes: [
        {
            unique: true,
            fields: ["uniqueId"]
        }
    ]
});

export default Device;
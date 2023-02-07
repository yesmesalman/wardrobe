import DeviceInfo from 'react-native-device-info';

class Global {
    static BASE_URL = "http://10.0.2.2:3000"

    static async getDeviceInfo() {
        const getAndroidId = await DeviceInfo.getAndroidId();
        const getApiLevel = await DeviceInfo.getApiLevel();
        const getApplicationName = DeviceInfo.getApplicationName();
        const getBaseOs = await DeviceInfo.getBaseOs();
        const getBuildId = await DeviceInfo.getBuildId();
        const getBatteryLevel = await DeviceInfo.getBatteryLevel();
        const getBootloader = await DeviceInfo.getBootloader();
        const getBrand = DeviceInfo.getBrand();
        const getBuildNumber = DeviceInfo.getBuildNumber();
        const getBundleId = DeviceInfo.getBundleId();
        const isCameraPresent = await DeviceInfo.isCameraPresent();
        const getCarrier = await DeviceInfo.getCarrier();
        const getCodename = await DeviceInfo.getCodename();
        const getDevice = await DeviceInfo.getDevice();
        const getDeviceId = DeviceInfo.getDeviceId();
        const getDeviceType = DeviceInfo.getDeviceType();
        const getDisplay = await DeviceInfo.getDisplay();
        const getDeviceName = await DeviceInfo.getDeviceName();
        const getDeviceToken = await DeviceInfo.getDeviceToken();
        const getFirstInstallTime = await DeviceInfo.getFirstInstallTime();
        const getFingerprint = await DeviceInfo.getFingerprint();
        const getFontScale = await DeviceInfo.getFontScale();
        const getFreeDiskStorage = await DeviceInfo.getFreeDiskStorage();
        const getFreeDiskStorageOld = await DeviceInfo.getFreeDiskStorageOld();
        const getHardware = await DeviceInfo.getHardware();
        const getHost = await DeviceInfo.getHost();
        const getIpAddress = await DeviceInfo.getIpAddress();
        const getIncremental = await DeviceInfo.getIncremental();
        const getInstallerPackageName = await DeviceInfo.getInstallerPackageName();
        const getInstallReferrer = await DeviceInfo.getInstallReferrer();
        const getInstanceId = await DeviceInfo.getInstanceId();
        const getLastUpdateTime = await DeviceInfo.getLastUpdateTime();
        const getMacAddress = await DeviceInfo.getMacAddress();
        const getManufacturer = await DeviceInfo.getManufacturer();
        const getMaxMemory = await DeviceInfo.getMaxMemory();
        const getModel = DeviceInfo.getModel();
        const getPhoneNumber = await DeviceInfo.getPhoneNumber();
        const getProduct = await DeviceInfo.getProduct();
        const getPreviewSdkInt = await DeviceInfo.getPreviewSdkInt();
        const getReadableVersion = DeviceInfo.getReadableVersion();
        const getSerialNumber = await DeviceInfo.getSerialNumber();
        const getSecurityPatch = await DeviceInfo.getSecurityPatch();
        const getSystemName = DeviceInfo.getSystemName();
        const getSystemVersion = DeviceInfo.getSystemVersion();
        const getTags = await DeviceInfo.getTags();
        const getType = await DeviceInfo.getType();
        const getTotalDiskCapacity = await DeviceInfo.getTotalDiskCapacity();
        const getTotalDiskCapacityOld = await DeviceInfo.getTotalDiskCapacityOld();
        const getTotalMemory = await DeviceInfo.getTotalMemory();
        const getUniqueId = await DeviceInfo.getUniqueId();
        const getUsedMemory = await DeviceInfo.getUsedMemory();
        const getUserAgent = await DeviceInfo.getUserAgent();
        const getUserAgentSync = DeviceInfo.getUserAgentSync();
        const getVersion = DeviceInfo.getVersion();
        const getBrightness = await DeviceInfo.getBrightness();
        const hasGms = await DeviceInfo.hasGms();
        const hasHms = await DeviceInfo.hasHms();
        const hasNotch = DeviceInfo.hasNotch();
        const hasDynamicIsland = DeviceInfo.hasDynamicIsland();
        const hasSystemFeature = await DeviceInfo.hasSystemFeature();
        const isAirplaneMode = await DeviceInfo.isAirplaneMode();
        const isBatteryCharging = await DeviceInfo.isBatteryCharging();
        const isEmulator = await DeviceInfo.isEmulator();
        const isKeyboardConnected = await DeviceInfo.isKeyboardConnected();
        const isLandscape = await DeviceInfo.isLandscape();
        const isLocationEnabled = await DeviceInfo.isLocationEnabled();
        const isMouseConnected = await DeviceInfo.isMouseConnected();
        const isHeadphonesConnected = await DeviceInfo.isHeadphonesConnected();
        const isPinOrFingerprintSet = await DeviceInfo.isPinOrFingerprintSet();
        const isTablet = DeviceInfo.isTablet();
        const isTabletMode = await DeviceInfo.isTabletMode();
        const syncUniqueId = await DeviceInfo.syncUniqueId();

        return {
            getAndroidId,
            getApiLevel,
            getApplicationName,
            getBaseOs,
            getBuildId,
            getBatteryLevel,
            getBootloader,
            getBrand,
            getBuildNumber,
            getBundleId,
            isCameraPresent,
            getCarrier,
            getCodename,
            getDevice,
            getDeviceId,
            getDeviceType,
            getDisplay,
            getDeviceName,
            getDeviceToken,
            getFirstInstallTime,
            getFingerprint,
            getFontScale,
            getFreeDiskStorage,
            getFreeDiskStorageOld,
            getHardware,
            getHost,
            getIpAddress,
            getIncremental,
            getInstallerPackageName,
            getInstallReferrer,
            getInstanceId,
            getLastUpdateTime,
            getMacAddress,
            getManufacturer,
            getMaxMemory,
            getModel,
            getPhoneNumber,
            getProduct,
            getPreviewSdkInt,
            getReadableVersion,
            getSerialNumber,
            getSecurityPatch,
            getSystemName,
            getSystemVersion,
            getTags,
            getType,
            getTotalDiskCapacity,
            getTotalDiskCapacityOld,
            getTotalMemory,
            getUniqueId,
            getUsedMemory,
            getUserAgent,
            getUserAgentSync,
            getVersion,
            getBrightness,
            hasGms,
            hasHms,
            hasNotch,
            hasDynamicIsland,
            hasSystemFeature,
            isAirplaneMode,
            isBatteryCharging,
            isEmulator,
            isKeyboardConnected,
            isLandscape,
            isLocationEnabled,
            isMouseConnected,
            isHeadphonesConnected,
            isPinOrFingerprintSet,
            isTablet,
            isTabletMode,
            syncUniqueId,
        }
    }

    static apiRequest(path, body) {
        return fetch(`${Global.BASE_URL}/api/${path}`, { method: 'POST', body: body });
    }
}

export default Global;
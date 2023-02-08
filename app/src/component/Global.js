import DeviceInfo from 'react-native-device-info';

class Global {
    static BASE_URL = "http://10.0.2.2:3000"

    static async getDeviceInfo() {
        const androidId = await DeviceInfo.getAndroidId();
        const apiLevel = await DeviceInfo.getApiLevel();
        const applicationName = DeviceInfo.getApplicationName();
        const baseOs = await DeviceInfo.getBaseOs();
        const buildId = await DeviceInfo.getBuildId();
        const batteryLevel = await DeviceInfo.getBatteryLevel();
        const bootloader = await DeviceInfo.getBootloader();
        const brand = DeviceInfo.getBrand();
        const buildNumber = DeviceInfo.getBuildNumber();
        const bundleId = DeviceInfo.getBundleId();
        const isCameraPresent = await DeviceInfo.isCameraPresent();
        const carrier = await DeviceInfo.getCarrier();
        const codename = await DeviceInfo.getCodename();
        const device = await DeviceInfo.getDevice();
        const deviceId = DeviceInfo.getDeviceId();
        const deviceType = DeviceInfo.getDeviceType();
        const display = await DeviceInfo.getDisplay();
        const deviceName = await DeviceInfo.getDeviceName();
        const deviceToken = await DeviceInfo.getDeviceToken();
        const firstInstallTime = await DeviceInfo.getFirstInstallTime();
        const fontScale = await DeviceInfo.getFontScale();
        const freeDiskStorage = await DeviceInfo.getFreeDiskStorage();
        const freeDiskStorageOld = await DeviceInfo.getFreeDiskStorageOld();
        const hardware = await DeviceInfo.getHardware();
        const host = await DeviceInfo.getHost();
        const ipAddress = await DeviceInfo.getIpAddress();
        const incremental = await DeviceInfo.getIncremental();
        const installerPackageName = await DeviceInfo.getInstallerPackageName();
        const installReferrer = await DeviceInfo.getInstallReferrer();
        const instanceId = await DeviceInfo.getInstanceId();
        const lastUpdateTime = await DeviceInfo.getLastUpdateTime();
        const macAddress = await DeviceInfo.getMacAddress();
        const manufacturer = await DeviceInfo.getManufacturer();
        const maxMemory = await DeviceInfo.getMaxMemory();
        const model = DeviceInfo.getModel();
        const phoneNumber = await DeviceInfo.getPhoneNumber();
        const product = await DeviceInfo.getProduct();
        const previewSdkInt = await DeviceInfo.getPreviewSdkInt();
        const readableVersion = DeviceInfo.getReadableVersion();
        const serialNumber = await DeviceInfo.getSerialNumber();
        const securityPatch = await DeviceInfo.getSecurityPatch();
        const systemName = DeviceInfo.getSystemName();
        const systemVersion = DeviceInfo.getSystemVersion();
        const tags = await DeviceInfo.getTags();
        const type = await DeviceInfo.getType();
        const totalDiskCapacity = await DeviceInfo.getTotalDiskCapacity();
        const totalDiskCapacityOld = await DeviceInfo.getTotalDiskCapacityOld();
        const totalMemory = await DeviceInfo.getTotalMemory();
        const uniqueId = await DeviceInfo.getUniqueId();
        const usedMemory = await DeviceInfo.getUsedMemory();
        const userAgent = await DeviceInfo.getUserAgent();
        const userAgentSync = DeviceInfo.getUserAgentSync();
        const version = DeviceInfo.getVersion();
        const brightness = await DeviceInfo.getBrightness();
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
            androidId,
            apiLevel,
            applicationName,
            baseOs,
            buildId,
            batteryLevel,
            bootloader,
            brand,
            buildNumber,
            bundleId,
            isCameraPresent,
            carrier,
            codename,
            device,
            deviceId,
            deviceType,
            display,
            deviceName,
            deviceToken,
            firstInstallTime,
            fontScale,
            freeDiskStorage,
            freeDiskStorageOld,
            hardware,
            host,
            ipAddress,
            incremental,
            installerPackageName,
            installReferrer,
            instanceId,
            lastUpdateTime,
            macAddress,
            manufacturer,
            maxMemory,
            model,
            phoneNumber,
            product,
            previewSdkInt,
            readableVersion,
            serialNumber,
            securityPatch,
            systemName,
            systemVersion,
            tags,
            type,
            totalDiskCapacity,
            totalDiskCapacityOld,
            totalMemory,
            uniqueId,
            usedMemory,
            userAgent,
            userAgentSync,
            version,
            brightness,
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
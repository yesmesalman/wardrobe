import DeviceInfo from "react-native-device-info";

const getDeviceInfo = async () => {
  let uniqueId = "";
  let apiLevel = "";
  let applicationName = "";
  let baseOs = "";
  let buildId = "";
  let batteryLevel = "";
  let bootloader = "";
  let brand = "";
  let buildNumber = "";
  let bundleId = "";
  let isCameraPresent = "";
  let carrier = "";
  let codename = "";
  let device = "";
  let deviceId = "";
  let deviceType = "";
  let display = "";
  let deviceName = "";
  let deviceToken = "";
  let firstInstallTime = "";
  let fontScale = "";
  let freeDiskStorage = "";
  let freeDiskStorageOld = "";
  let hardware = "";
  let host = "";
  let ipAddress = "";
  let incremental = "";
  let installerPackageName = "";
  let installReferrer = "";
  let instanceId = "";
  let lastUpdateTime = "";
  let macAddress = "";
  let manufacturer = "";
  let maxMemory = "";
  let model = "";
  let phoneNumber = "";
  let product = "";
  let previewSdkInt = "";
  let readableVersion = "";
  let serialNumber = "";
  let securityPatch = "";
  let systemName = "";
  let systemVersion = "";
  let tags = "";
  let type = "";
  let androidId = "";
  let totalDiskCapacity = "";
  let totalDiskCapacityOld = "";
  let totalMemory = "";
  let usedMemory = "";
  let userAgent = "";
  let userAgentSync = "";
  let version = "";
  let brightness = "";
  let hasGms = "";
  let hasHms = "";
  let hasNotch = "";
  let hasDynamicIsland = "";
  let hasSystemFeature = "";
  let isAirplaneMode = "";
  let isBatteryCharging = "";
  let isEmulator = "";
  let isKeyboardConnected = "";
  let isLandscape = "";
  let isLocationEnabled = "";
  let isMouseConnected = "";
  let isHeadphonesConnected = "";
  let isPinOrFingerprintSet = "";
  let isTablet = "";
  let isTabletMode = "";
  let syncUniqueId = "";

  try {
    androidId = await DeviceInfo.getAndroidId();
  } catch (e) {
    androidId = "N/A";
  }
  try {
    apiLevel = await DeviceInfo.getApiLevel();
  } catch (e) {
    apiLevel = "N/A";
  }
  try {
    applicationName = DeviceInfo.getApplicationName();
  } catch (e) {
    applicationName = "N/A";
  }
  try {
    baseOs = await DeviceInfo.getBaseOs();
  } catch (e) {
    baseOs = "N/A";
  }
  try {
    buildId = await DeviceInfo.getBuildId();
  } catch (e) {
    buildId = "N/A";
  }
  try {
    batteryLevel = await DeviceInfo.getBatteryLevel();
  } catch (e) {
    batteryLevel = "N/A";
  }
  try {
    bootloader = await DeviceInfo.getBootloader();
  } catch (e) {
    bootloader = "N/A";
  }
  try {
    brand = DeviceInfo.getBrand();
  } catch (e) {
    brand = "N/A";
  }
  try {
    buildNumber = DeviceInfo.getBuildNumber();
  } catch (e) {
    buildNumber = "N/A";
  }
  try {
    bundleId = DeviceInfo.getBundleId();
  } catch (e) {
    bundleId = "N/A";
  }
  try {
    isCameraPresent = await DeviceInfo.isCameraPresent();
  } catch (e) {
    isCameraPresent = "N/A";
  }
  try {
    carrier = await DeviceInfo.getCarrier();
  } catch (e) {
    carrier = "N/A";
  }
  try {
    codename = await DeviceInfo.getCodename();
  } catch (e) {
    codename = "N/A";
  }
  try {
    device = await DeviceInfo.getDevice();
  } catch (e) {
    device = "N/A";
  }
  try {
    deviceId = DeviceInfo.getDeviceId();
  } catch (e) {
    deviceId = "N/A";
  }
  try {
    deviceType = DeviceInfo.getDeviceType();
  } catch (e) {
    deviceType = "N/A";
  }
  try {
    display = await DeviceInfo.getDisplay();
  } catch (e) {
    display = "N/A";
  }
  try {
    deviceName = await DeviceInfo.getDeviceName();
  } catch (e) {
    deviceName = "N/A";
  }
  try {
    deviceToken = await DeviceInfo.getDeviceToken();
  } catch (e) {
    deviceToken = "N/A";
  }
  try {
    firstInstallTime = await DeviceInfo.getFirstInstallTime();
  } catch (e) {
    firstInstallTime = "N/A";
  }
  try {
    fontScale = await DeviceInfo.getFontScale();
  } catch (e) {
    fontScale = "N/A";
  }
  try {
    freeDiskStorage = await DeviceInfo.getFreeDiskStorage();
  } catch (e) {
    freeDiskStorage = "N/A";
  }
  try {
    freeDiskStorageOld = await DeviceInfo.getFreeDiskStorageOld();
  } catch (e) {
    freeDiskStorageOld = "N/A";
  }
  try {
    hardware = await DeviceInfo.getHardware();
  } catch (e) {
    hardware = "N/A";
  }
  try {
    host = await DeviceInfo.getHost();
  } catch (e) {
    host = "N/A";
  }
  try {
    ipAddress = await DeviceInfo.getIpAddress();
  } catch (e) {
    ipAddress = "N/A";
  }
  try {
    incremental = await DeviceInfo.getIncremental();
  } catch (e) {
    incremental = "N/A";
  }
  try {
    installerPackageName = await DeviceInfo.getInstallerPackageName();
  } catch (e) {
    installerPackageName = "N/A";
  }
  try {
    installReferrer = await DeviceInfo.getInstallReferrer();
  } catch (e) {
    installReferrer = "N/A";
  }
  try {
    instanceId = await DeviceInfo.getInstanceId();
  } catch (e) {
    instanceId = "N/A";
  }
  try {
    lastUpdateTime = await DeviceInfo.getLastUpdateTime();
  } catch (e) {
    lastUpdateTime = "N/A";
  }
  try {
    macAddress = await DeviceInfo.getMacAddress();
  } catch (e) {
    macAddress = "N/A";
  }
  try {
    manufacturer = await DeviceInfo.getManufacturer();
  } catch (e) {
    manufacturer = "N/A";
  }
  try {
    maxMemory = await DeviceInfo.getMaxMemory();
  } catch (e) {
    maxMemory = "N/A";
  }
  try {
    model = DeviceInfo.getModel();
  } catch (e) {
    model = "N/A";
  }
  try {
    phoneNumber = await DeviceInfo.getPhoneNumber();
  } catch (e) {
    phoneNumber = "N/A";
  }
  try {
    product = await DeviceInfo.getProduct();
  } catch (e) {
    product = "N/A";
  }
  try {
    previewSdkInt = await DeviceInfo.getPreviewSdkInt();
  } catch (e) {
    previewSdkInt = "N/A";
  }
  try {
    readableVersion = DeviceInfo.getReadableVersion();
  } catch (e) {
    readableVersion = "N/A";
  }
  try {
    serialNumber = await DeviceInfo.getSerialNumber();
  } catch (e) {
    serialNumber = "N/A";
  }
  try {
    securityPatch = await DeviceInfo.getSecurityPatch();
  } catch (e) {
    securityPatch = "N/A";
  }
  try {
    systemName = DeviceInfo.getSystemName();
  } catch (e) {
    systemName = "N/A";
  }
  try {
    systemVersion = DeviceInfo.getSystemVersion();
  } catch (e) {
    systemVersion = "N/A";
  }
  try {
    tags = await DeviceInfo.getTags();
  } catch (e) {
    tags = "N/A";
  }
  try {
    type = await DeviceInfo.getType();
  } catch (e) {
    type = "N/A";
  }
  try {
    totalDiskCapacity = await DeviceInfo.getTotalDiskCapacity();
  } catch (e) {
    totalDiskCapacity = "N/A";
  }
  try {
    totalDiskCapacityOld = await DeviceInfo.getTotalDiskCapacityOld();
  } catch (e) {
    totalDiskCapacityOld = "N/A";
  }
  try {
    totalMemory = await DeviceInfo.getTotalMemory();
  } catch (e) {
    totalMemory = "N/A";
  }
  try {
    uniqueId = await DeviceInfo.getUniqueId();
  } catch (e) {
    uniqueId = "N/A";
  }
  try {
    usedMemory = await DeviceInfo.getUsedMemory();
  } catch (e) {
    usedMemory = "N/A";
  }
  try {
    userAgent = await DeviceInfo.getUserAgent();
  } catch (e) {
    userAgent = "N/A";
  }
  try {
    userAgentSync = DeviceInfo.getUserAgentSync();
  } catch (e) {
    userAgentSync = "N/A";
  }
  try {
    version = DeviceInfo.getVersion();
  } catch (e) {
    version = "N/A";
  }
  try {
    brightness = await DeviceInfo.getBrightness();
  } catch (e) {
    brightness = "N/A";
  }
  try {
    hasGms = await DeviceInfo.hasGms();
  } catch (e) {
    hasGms = "N/A";
  }
  try {
    hasHms = await DeviceInfo.hasHms();
  } catch (e) {
    hasHms = "N/A";
  }
  try {
    hasNotch = DeviceInfo.hasNotch();
  } catch (e) {
    hasNotch = "N/A";
  }
  try {
    hasDynamicIsland = DeviceInfo.hasDynamicIsland();
  } catch (e) {
    hasDynamicIsland = "N/A";
  }
  try {
    hasSystemFeature = await DeviceInfo.hasSystemFeature();
  } catch (e) {
    hasSystemFeature = "N/A";
  }
  try {
    isAirplaneMode = await DeviceInfo.isAirplaneMode();
  } catch (e) {
    isAirplaneMode = "N/A";
  }
  try {
    isBatteryCharging = await DeviceInfo.isBatteryCharging();
  } catch (e) {
    isBatteryCharging = "N/A";
  }
  try {
    isEmulator = await DeviceInfo.isEmulator();
  } catch (e) {
    isEmulator = "N/A";
  }
  try {
    isKeyboardConnected = await DeviceInfo.isKeyboardConnected();
  } catch (e) {
    isKeyboardConnected = "N/A";
  }
  try {
    isLandscape = await DeviceInfo.isLandscape();
  } catch (e) {
    isLandscape = "N/A";
  }
  try {
    isLocationEnabled = await DeviceInfo.isLocationEnabled();
  } catch (e) {
    isLocationEnabled = "N/A";
  }
  try {
    isMouseConnected = await DeviceInfo.isMouseConnected();
  } catch (e) {
    isMouseConnected = "N/A";
  }
  try {
    isHeadphonesConnected = await DeviceInfo.isHeadphonesConnected();
  } catch (e) {
    isHeadphonesConnected = "N/A";
  }
  try {
    isPinOrFingerprintSet = await DeviceInfo.isPinOrFingerprintSet();
  } catch (e) {
    isPinOrFingerprintSet = "N/A";
  }
  try {
    isTablet = DeviceInfo.isTablet();
  } catch (e) {
    isTablet = "N/A";
  }
  try {
    isTabletMode = await DeviceInfo.isTabletMode();
  } catch (e) {
    isTabletMode = "N/A";
  }
  try {
    syncUniqueId = await DeviceInfo.syncUniqueId();
  } catch (e) {
    syncUniqueId = "N/A";
  }

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
  };
};

export default getDeviceInfo;

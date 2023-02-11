-- phpMyAdmin SQL Dump
-- version 5.1.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Feb 11, 2023 at 04:19 PM
-- Server version: 10.4.18-MariaDB
-- PHP Version: 7.4.16

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `wardrobe`
--

-- --------------------------------------------------------

--
-- Table structure for table `devices`
--

CREATE TABLE `devices` (
  `id` int(11) NOT NULL,
  `uniqueId` varchar(100) NOT NULL,
  `apiLevel` varchar(5) DEFAULT NULL,
  `applicationName` varchar(25) DEFAULT NULL,
  `baseOs` varchar(25) DEFAULT NULL,
  `buildId` varchar(100) DEFAULT NULL,
  `batteryLevel` varchar(10) DEFAULT NULL,
  `bootloader` varchar(25) DEFAULT NULL,
  `brand` varchar(25) DEFAULT NULL,
  `buildNumber` varchar(3) DEFAULT NULL,
  `bundleId` varchar(50) DEFAULT NULL,
  `carrier` varchar(50) DEFAULT NULL,
  `codename` varchar(10) DEFAULT NULL,
  `device` varchar(55) DEFAULT NULL,
  `deviceId` varchar(100) DEFAULT NULL,
  `deviceName` varchar(100) DEFAULT NULL,
  `deviceToken` varchar(100) DEFAULT NULL,
  `deviceType` varchar(50) DEFAULT NULL,
  `display` varchar(155) DEFAULT NULL,
  `firstInstallTime` varchar(50) DEFAULT NULL,
  `fontScale` varchar(2) DEFAULT NULL,
  `freeDiskStorage` varchar(50) DEFAULT NULL,
  `freeDiskStorageOld` varchar(50) DEFAULT NULL,
  `hardware` varchar(50) DEFAULT NULL,
  `host` varchar(100) DEFAULT NULL,
  `incremental` varchar(50) DEFAULT NULL,
  `installReferrer` varchar(255) DEFAULT NULL,
  `installerPackageName` varchar(155) DEFAULT NULL,
  `instanceId` varchar(50) DEFAULT NULL,
  `ipAddress` varchar(50) DEFAULT NULL,
  `lastUpdateTime` varchar(50) DEFAULT NULL,
  `macAddress` varchar(50) DEFAULT NULL,
  `manufacturer` varchar(100) DEFAULT NULL,
  `maxMemory` varchar(50) DEFAULT NULL,
  `model` varchar(150) DEFAULT NULL,
  `phoneNumber` varchar(50) DEFAULT NULL,
  `previewSdkInt` varchar(5) DEFAULT NULL,
  `product` varchar(50) DEFAULT NULL,
  `readableVersion` varchar(50) DEFAULT NULL,
  `securityPatch` varchar(50) DEFAULT NULL,
  `serialNumber` varchar(100) DEFAULT NULL,
  `systemName` varchar(50) DEFAULT NULL,
  `systemVersion` varchar(50) DEFAULT NULL,
  `tags` varchar(50) DEFAULT NULL,
  `totalDiskCapacity` varchar(50) DEFAULT NULL,
  `totalDiskCapacityOld` varchar(50) DEFAULT NULL,
  `totalMemory` varchar(50) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `androidId` varchar(100) DEFAULT NULL,
  `usedMemory` varchar(50) DEFAULT NULL,
  `userAgent` varchar(500) DEFAULT NULL,
  `userAgentSync` varchar(500) DEFAULT NULL,
  `version` varchar(5) DEFAULT NULL,
  `brightness` varchar(5) DEFAULT NULL,
  `hasDynamicIsland` varchar(10) DEFAULT NULL,
  `hasGms` varchar(10) DEFAULT NULL,
  `hasHms` varchar(10) DEFAULT NULL,
  `hasNotch` varchar(10) DEFAULT NULL,
  `hasSystemFeature` varchar(10) DEFAULT NULL,
  `isAirplaneMode` varchar(10) DEFAULT NULL,
  `isBatteryCharging` varchar(10) DEFAULT NULL,
  `isCameraPresent` varchar(10) DEFAULT NULL,
  `isEmulator` varchar(10) DEFAULT NULL,
  `isHeadphonesConnected` varchar(10) DEFAULT NULL,
  `isKeyboardConnected` varchar(10) DEFAULT NULL,
  `isLandscape` varchar(10) DEFAULT NULL,
  `isLocationEnabled` varchar(10) DEFAULT NULL,
  `isMouseConnected` varchar(10) DEFAULT NULL,
  `isPinOrFingerprintSet` varchar(10) DEFAULT NULL,
  `isTablet` varchar(10) DEFAULT NULL,
  `isTabletMode` varchar(10) DEFAULT NULL,
  `syncUniqueId` varchar(100) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `devices`
--

INSERT INTO `devices` (`id`, `uniqueId`, `apiLevel`, `applicationName`, `baseOs`, `buildId`, `batteryLevel`, `bootloader`, `brand`, `buildNumber`, `bundleId`, `carrier`, `codename`, `device`, `deviceId`, `deviceName`, `deviceToken`, `deviceType`, `display`, `firstInstallTime`, `fontScale`, `freeDiskStorage`, `freeDiskStorageOld`, `hardware`, `host`, `incremental`, `installReferrer`, `installerPackageName`, `instanceId`, `ipAddress`, `lastUpdateTime`, `macAddress`, `manufacturer`, `maxMemory`, `model`, `phoneNumber`, `previewSdkInt`, `product`, `readableVersion`, `securityPatch`, `serialNumber`, `systemName`, `systemVersion`, `tags`, `totalDiskCapacity`, `totalDiskCapacityOld`, `totalMemory`, `type`, `androidId`, `usedMemory`, `userAgent`, `userAgentSync`, `version`, `brightness`, `hasDynamicIsland`, `hasGms`, `hasHms`, `hasNotch`, `hasSystemFeature`, `isAirplaneMode`, `isBatteryCharging`, `isCameraPresent`, `isEmulator`, `isHeadphonesConnected`, `isKeyboardConnected`, `isLandscape`, `isLocationEnabled`, `isMouseConnected`, `isPinOrFingerprintSet`, `isTablet`, `isTabletMode`, `syncUniqueId`, `createdAt`, `updatedAt`) VALUES
(1, 'A9EB4A06-C681-4795-9B3F-BA3427133031', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2023-02-10 22:58:55', '2023-02-10 22:58:55');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

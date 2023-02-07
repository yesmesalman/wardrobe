-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 07, 2023 at 01:00 PM
-- Server version: 10.4.27-MariaDB
-- PHP Version: 7.4.33

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
  `unique_id` varchar(100) DEFAULT NULL,
  `api_level` varchar(5) DEFAULT NULL,
  `application_name` varchar(25) DEFAULT NULL,
  `base_os` varchar(25) DEFAULT NULL,
  `battery_Level` varchar(10) DEFAULT NULL,
  `bootloader` varchar(25) DEFAULT NULL,
  `brand` varchar(25) DEFAULT NULL,
  `brightness` varchar(5) DEFAULT NULL,
  `build_id` varchar(100) DEFAULT NULL,
  `build_number` varchar(3) DEFAULT NULL,
  `bundle_id` varchar(50) DEFAULT NULL,
  `carrier` varchar(50) DEFAULT NULL,
  `code_name` varchar(10) DEFAULT NULL,
  `device` varchar(55) DEFAULT NULL,
  `device_id` varchar(100) DEFAULT NULL,
  `device_name` varchar(100) DEFAULT NULL,
  `device_token` varchar(100) DEFAULT NULL,
  `device_type` varchar(50) NOT NULL,
  `display` varchar(155) DEFAULT NULL,
  `first_install_time` varchar(50) DEFAULT NULL,
  `font_scale` varchar(2) DEFAULT NULL,
  `free_disk_storage` varchar(50) DEFAULT NULL,
  `free_disk_storage_old` varchar(50) DEFAULT NULL,
  `hardware` varchar(50) DEFAULT NULL,
  `host` varchar(100) DEFAULT NULL,
  `incremental` varchar(50) DEFAULT NULL,
  `install_referrer` varchar(255) DEFAULT NULL,
  `installer_package_name` varchar(155) DEFAULT NULL,
  `instance_id` varchar(50) DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `last_update_time` varchar(50) DEFAULT NULL,
  `mac_address` varchar(50) DEFAULT NULL,
  `manufacturer` varchar(100) DEFAULT NULL,
  `max_memory` varchar(50) DEFAULT NULL,
  `model` varchar(150) DEFAULT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `preview_sdk_int` varchar(5) DEFAULT NULL,
  `product` varchar(50) DEFAULT NULL,
  `readable_version` varchar(50) DEFAULT NULL,
  `security_patch` varchar(50) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `system_name` varchar(50) DEFAULT NULL,
  `system_version` varchar(50) DEFAULT NULL,
  `tags` varchar(50) DEFAULT NULL,
  `total_disk_capacity` varchar(50) DEFAULT NULL,
  `total_disk_capacity_old` varchar(50) DEFAULT NULL,
  `total_memory` varchar(50) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `android_id` varchar(100) NOT NULL,
  `used_memory` varchar(50) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `user_agent_sync` varchar(500) DEFAULT NULL,
  `version` varchar(5) DEFAULT NULL,
  `has_dynamic_island` varchar(10) DEFAULT NULL,
  `has_gms` varchar(10) DEFAULT NULL,
  `has_hms` varchar(10) DEFAULT NULL,
  `has_notch` varchar(10) DEFAULT NULL,
  `has_system_feature` varchar(10) DEFAULT NULL,
  `is_airplane_mode` varchar(10) DEFAULT NULL,
  `is_battery_charging` varchar(10) DEFAULT NULL,
  `is_camera_present` varchar(10) DEFAULT NULL,
  `is_emulator` varchar(10) DEFAULT NULL,
  `is_headphones_connected` varchar(10) DEFAULT NULL,
  `is_keyboard_connected` varchar(10) DEFAULT NULL,
  `is_landscape` varchar(10) DEFAULT NULL,
  `is_location_enabled` varchar(10) DEFAULT NULL,
  `is_mouse_connected` varchar(10) DEFAULT NULL,
  `is_pin_or_fingerprint_set` varchar(10) DEFAULT NULL,
  `is_tablet` varchar(10) DEFAULT NULL,
  `is_tablet_mode` varchar(10) DEFAULT NULL,
  `sync_unique_id` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

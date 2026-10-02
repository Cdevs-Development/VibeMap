-- phpMyAdmin SQL Dump
-- version 4.8.4
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 11, 2026 at 10:18 AM
-- Server version: 10.1.37-MariaDB
-- PHP Version: 5.6.40

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `vibemap`
--

-- --------------------------------------------------------

--
-- Table structure for table `beneficiaries`
--
CREATE DATABASE IF NOT EXISTS `vibemap`;/*!80016 DEFAULT ENCRYPTION='N' */;
USE vibemap;


CREATE TABLE `beneficiaries` (
  `id` char(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `is_confirmed` tinyint(1) NOT NULL,
  `confirmation_token` varchar(255) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `user_id` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `beneficiaries`
--

INSERT INTO `beneficiaries` (`id`, `name`, `phone`, `is_confirmed`, `confirmation_token`, `confirmed_at`, `created_at`, `user_id`) VALUES
('1705233e-09db-43b8-9d06-ef1bf35346df', 'mum', '09022222222', 0, NULL, NULL, '2026-06-10 16:33:51', '9d8b8f8a-39da-4660-8750-ed2de207ba59'),
('fcb293cc-0f2e-494b-8f72-8d99d1d94c13', 'mum', '08033333333', 0, NULL, NULL, '2026-06-10 21:59:37', 'c295725e-08c4-4ab5-86d1-2df1c30fbf0e');

-- --------------------------------------------------------

--
-- Table structure for table `location_pings`
--

CREATE TABLE `location_pings` (
  `id` char(36) NOT NULL,
  `raw_lat` decimal(9,6) NOT NULL,
  `raw_lng` decimal(9,6) NOT NULL,
  `smoothed_lat` decimal(9,6) NOT NULL,
  `smoothed_lng` decimal(9,6) NOT NULL,
  `accuracy_meters` int(11) NOT NULL,
  `signal_source` enum('gps','network','wifi','unknown') DEFAULT NULL,
  `speed_ms` decimal(6,2) DEFAULT NULL,
  `heading` decimal(6,2) DEFAULT NULL,
  `recorded_at` datetime NOT NULL,
  `trip_id` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `location_pings`
--

INSERT INTO `location_pings` (`id`, `raw_lat`, `raw_lng`, `smoothed_lat`, `smoothed_lng`, `accuracy_meters`, `signal_source`, `speed_ms`, `heading`, `recorded_at`, `trip_id`) VALUES
('77b35206-d412-431c-ae2d-a08be2a1f717', '9.076500', '7.398300', '9.076500', '7.398300', 5, 'gps', '0.00', '0.00', '2026-06-10 18:43:11', 'ad3c15ad-861d-43f9-868b-7d0f25b49c77');

-- --------------------------------------------------------

--
-- Table structure for table `sos_events`
--

CREATE TABLE `sos_events` (
  `id` char(36) NOT NULL,
  `triggered_lat` decimal(9,6) NOT NULL,
  `triggered_lng` decimal(9,6) NOT NULL,
  `status` enum('active','resolved','cancelled') NOT NULL,
  `triggered_at` datetime NOT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `resolution_note` text,
  `user_id` char(36) NOT NULL,
  `trip_id` char(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `sos_events`
--

INSERT INTO `sos_events` (`id`, `triggered_lat`, `triggered_lng`, `status`, `triggered_at`, `resolved_at`, `resolution_note`, `user_id`, `trip_id`) VALUES
('93d573be-129c-42de-81f4-52a39814d628', '9.076500', '7.398300', 'resolved', '2026-06-10 18:57:14', '2026-06-10 19:02:07', 'User is safe', '9d8b8f8a-39da-4660-8750-ed2de207ba59', 'ad3c15ad-861d-43f9-868b-7d0f25b49c77');

-- --------------------------------------------------------

--
-- Table structure for table `trips`
--

CREATE TABLE `trips` (
  `id` char(36) NOT NULL,
  `origin_lat` decimal(9,6) NOT NULL,
  `origin_lng` decimal(9,6) NOT NULL,
  `destination_lat` decimal(9,6) NOT NULL,
  `destination_lng` decimal(9,6) NOT NULL,
  `destination_name` varchar(255) NOT NULL,
  `current_lat` decimal(9,6) DEFAULT NULL,
  `current_lng` decimal(9,6) DEFAULT NULL,
  `status` enum('active','completed','cancelled','sos_active') NOT NULL,
  `started_at` datetime NOT NULL,
  `ended_at` datetime DEFAULT NULL,
  `share_token` varchar(64) NOT NULL,
  `user_id` char(36) NOT NULL,
  `last_ping_at` datetime DEFAULT NULL,
  `last_known_lat` decimal(9,6) DEFAULT NULL,
  `last_known_lng` decimal(9,6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `trips`
--

INSERT INTO `trips` (`id`, `origin_lat`, `origin_lng`, `destination_lat`, `destination_lng`, `destination_name`, `current_lat`, `current_lng`, `status`, `started_at`, `ended_at`, `share_token`, `user_id`, `last_ping_at`, `last_known_lat`, `last_known_lng`) VALUES
('696ef206-9b63-41ce-910c-7b6228099c04', '9.076500', '7.398300', '9.057900', '7.495100', 'jabi lake mall', '9.076500', '7.398300', 'completed', '2026-06-10 18:19:35', '2026-06-10 18:21:40', 'b0f8d25139974ebe8921dab2e0450948', '9d8b8f8a-39da-4660-8750-ed2de207ba59', '2026-06-10 18:19:35', '9.076500', '7.398300'),
('ad3c15ad-861d-43f9-868b-7d0f25b49c77', '9.076500', '7.398300', '9.057900', '7.495100', 'Jabi Lake Mall', '9.076500', '7.398300', 'active', '2026-06-10 18:42:01', NULL, 'd23f3eacb02a4ac19fc81f87f6de7cbc', '9d8b8f8a-39da-4660-8750-ed2de207ba59', '2026-06-10 18:43:11', '9.076500', '7.398300');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` char(36) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `password_hash` text NOT NULL,
  `avatar_url` text,
  `is_verified` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `email`, `phone`, `password_hash`, `avatar_url`, `is_verified`, `is_active`, `created_at`, `updated_at`) VALUES
('9d8b8f8a-39da-4660-8750-ed2de207ba59', 'Ayinde Adewale', 'user@example.com', '09087875839', '$2b$12$9V1fSd6EmY2klrFbQudaKefJ3HEo82LsaPeyiNJzU9ZzYURbvsjmW', NULL, 0, 1, '2026-06-10 14:57:21', '2026-06-10 14:57:21'),
('c295725e-08c4-4ab5-86d1-2df1c30fbf0e', 'EXCLE TOBILOBA', 'true@example.com', '08033601323', '$2b$12$xu3FKEmCfiJ8Sd6ZD9SbSu4wdMInTHvWPGXit1F.75rQxN/OIvska', NULL, 0, 1, '2026-06-10 21:56:00', '2026-06-10 21:56:00');

-- --------------------------------------------------------

--
-- Table structure for table `vibe_pins`
--

CREATE TABLE `vibe_pins` (
  `id` char(36) NOT NULL,
  `category` enum('party','wedding','construction','unsafe','market','traffic') NOT NULL,
  `lat` decimal(9,6) NOT NULL,
  `lng` decimal(9,6) NOT NULL,
  `note` text,
  `confirmation_count` int(11) NOT NULL DEFAULT '1',
  `expires_at` datetime NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `source` enum('user','instagram','twitter','organiser') NOT NULL,
  `created_at` datetime NOT NULL,
  `user_id` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `vibe_pins`
--

INSERT INTO `vibe_pins` (`id`, `category`, `lat`, `lng`, `note`, `confirmation_count`, `expires_at`, `is_active`, `source`, `created_at`, `user_id`) VALUES
('e189c6ed-4fe4-4a74-b09a-f5a28946adaa', 'traffic', '9.076500', '7.398300', 'Heavy traffic near junction', 2, '2026-06-11 19:16:44', 0, 'user', '2026-06-10 19:16:44', '9d8b8f8a-39da-4660-8750-ed2de207ba59');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `beneficiaries`
--
ALTER TABLE `beneficiaries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_beneficiaries_users_idx` (`user_id`);

--
-- Indexes for table `location_pings`
--
ALTER TABLE `location_pings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_UNIQUE` (`id`),
  ADD KEY `fk_location_pings_trips1_idx` (`trip_id`);

--
-- Indexes for table `sos_events`
--
ALTER TABLE `sos_events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_UNIQUE` (`id`),
  ADD KEY `fk_sos_events_users1_idx` (`user_id`),
  ADD KEY `fk_sos_events_trips1_idx` (`trip_id`);

--
-- Indexes for table `trips`
--
ALTER TABLE `trips`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `share_token_UNIQUE` (`share_token`),
  ADD KEY `fk_trips_users1_idx` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email_UNIQUE` (`email`),
  ADD UNIQUE KEY `phone_UNIQUE` (`phone`);

--
-- Indexes for table `vibe_pins`
--
ALTER TABLE `vibe_pins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_UNIQUE` (`id`),
  ADD KEY `fk_vibe_pins_users1_idx` (`user_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `beneficiaries`
--
ALTER TABLE `beneficiaries`
  ADD CONSTRAINT `fk_beneficiaries_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Constraints for table `location_pings`
--
ALTER TABLE `location_pings`
  ADD CONSTRAINT `fk_location_pings_trips1` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Constraints for table `sos_events`
--
ALTER TABLE `sos_events`
  ADD CONSTRAINT `fk_sos_events_trips1` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_sos_events_users1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Constraints for table `trips`
--
ALTER TABLE `trips`
  ADD CONSTRAINT `fk_trips_users1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Constraints for table `vibe_pins`
--
ALTER TABLE `vibe_pins`
  ADD CONSTRAINT `fk_vibe_pins_users1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

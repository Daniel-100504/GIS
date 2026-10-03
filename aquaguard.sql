-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 29, 2026 at 05:29 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `aquaguard`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_accounts`
--

CREATE TABLE `admin_accounts` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin_accounts`
--

INSERT INTO `admin_accounts` (`id`, `username`, `password_hash`, `full_name`, `email`, `created_at`) VALUES
(1, 'admin', '$2y$10$ZpJHon7I1UWHLb74YnGKGO3ZrQeE/YZbYVIcq3ZCXUotdsEV5iqha', 'Daniel Magarao', 'danielmagarao002@gmail.com', '2026-09-03 13:56:22');

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `id` int(11) NOT NULL,
  `actor_username` varchar(50) NOT NULL,
  `actor_role` varchar(20) NOT NULL,
  `action` varchar(190) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_log`
--

INSERT INTO `audit_log` (`id`, `actor_username`, `actor_role`, `action`, `created_at`) VALUES
(9, 'admin', 'admin', 'logout', '2026-09-04 16:36:15'),
(10, 'admin', 'admin', 'login', '2026-09-04 16:36:17'),
(11, 'admin', 'admin', 'logout', '2026-09-04 16:53:00'),
(12, 'admin', 'admin', 'login', '2026-09-04 16:56:25'),
(13, 'admin', 'admin', 'logout', '2026-09-04 16:56:30'),
(14, 'kaye123', 'menro', 'login', '2026-09-04 16:56:36'),
(15, 'kaye123', 'menro', 'logout', '2026-09-04 16:56:40'),
(16, 'admin', 'admin', 'login', '2026-09-04 16:56:43'),
(17, 'admin', 'admin', 'logout', '2026-09-04 16:56:48'),
(18, 'admin', 'admin', 'login', '2026-09-04 16:56:50'),
(19, 'admin', 'admin', 'logout', '2026-09-04 16:56:56'),
(20, 'admin', 'admin', 'login', '2026-09-04 16:56:59'),
(21, 'admin', 'admin', 'logout', '2026-09-04 16:57:27'),
(22, 'admin', 'admin', 'login', '2026-09-04 16:57:31'),
(23, 'admin', 'admin', 'logout', '2026-09-04 16:57:34'),
(24, 'rome123', 'ranger', 'login', '2026-09-04 16:57:41'),
(25, 'rome123', 'ranger', 'logout', '2026-09-04 16:57:50'),
(26, 'admin', 'admin', 'login', '2026-09-04 16:57:52'),
(27, 'admin', 'admin', 'logout', '2026-09-04 16:58:01'),
(28, 'admin', 'admin', 'login', '2026-09-04 16:58:38'),
(29, 'admin', 'admin', 'logout', '2026-09-04 16:58:42'),
(30, 'kaye123', 'menro', 'login', '2026-09-04 16:58:53'),
(31, 'kaye123', 'menro', 'logout', '2026-09-04 17:01:15'),
(32, 'admin', 'admin', 'login', '2026-09-04 17:01:18'),
(33, 'admin', 'admin', 'logout', '2026-09-04 17:01:36'),
(34, 'admin', 'admin', 'login', '2026-09-04 17:09:52'),
(35, 'daniel123', 'menro', 'login', '2026-09-04 17:14:12'),
(36, 'admin', 'admin', 'login', '2026-09-04 17:23:37'),
(37, 'admin', 'admin', 'logout', '2026-09-04 17:23:50'),
(38, 'daniel123', 'menro', 'login', '2026-09-04 17:23:56'),
(39, 'daniel123', 'menro', 'logout', '2026-09-04 17:28:49'),
(40, 'rome123', 'ranger', 'login', '2026-09-04 17:29:03'),
(41, 'rome123', 'ranger', 'logout', '2026-09-04 17:29:12'),
(42, 'admin', 'admin', 'login', '2026-09-04 17:29:17'),
(43, 'admin', 'admin', 'logout', '2026-09-04 17:29:47'),
(44, 'admin', 'admin', 'login', '2026-09-06 12:28:08'),
(45, 'admin', 'admin', 'logout', '2026-09-06 12:37:20'),
(46, 'alessandra123', 'menro', 'login', '2026-09-06 12:37:28'),
(47, 'alessandra123', 'menro', 'logout', '2026-09-06 12:37:35'),
(48, 'admin', 'admin', 'login', '2026-09-06 12:37:59'),
(49, 'admin', 'admin', 'logout', '2026-09-06 12:53:21'),
(50, 'admin', 'admin', 'login', '2026-09-06 12:53:34'),
(51, 'admin', 'admin', 'logout', '2026-09-06 12:53:54'),
(52, 'admin', 'admin', 'login', '2026-09-06 12:54:15'),
(53, 'admin', 'admin', 'logout', '2026-09-06 13:52:08'),
(54, 'admin', 'admin', 'login', '2026-09-06 13:52:17'),
(55, 'admin', 'admin', 'logout', '2026-09-06 13:52:24'),
(56, 'admin', 'admin', 'login', '2026-09-06 13:53:01'),
(57, 'admin', 'admin', 'logout', '2026-09-06 14:18:07'),
(58, 'kaye123', 'menro', 'login', '2026-09-06 14:18:19'),
(59, 'admin', 'admin', 'login', '2026-09-06 14:25:58'),
(60, 'admin', 'admin', 'logout', '2026-09-06 15:01:00'),
(61, 'admin', 'admin', 'login', '2026-09-06 15:01:03'),
(62, 'admin', 'admin', 'logout', '2026-09-06 15:27:11'),
(63, 'admin', 'admin', 'login', '2026-09-06 15:28:26'),
(64, 'admin', 'admin', 'login', '2026-09-08 04:40:34'),
(65, 'admin', 'admin', 'logout', '2026-09-08 04:41:32'),
(66, 'dyanne67', 'menro', 'login', '2026-09-08 04:41:49'),
(67, 'dyanne67', 'menro', 'logout', '2026-09-08 05:06:13'),
(68, 'dyanne67', 'menro', 'login', '2026-09-08 05:06:24'),
(69, 'dyanne67', 'menro', 'logout', '2026-09-08 05:18:50'),
(70, 'kaye123', 'menro', 'login', '2026-09-08 05:22:59'),
(71, 'kaye123', 'menro', 'logout', '2026-09-08 05:23:11'),
(72, 'admin', 'admin', 'login', '2026-09-08 05:23:23'),
(73, 'admin', 'admin', 'logout', '2026-09-08 05:24:25'),
(74, 'admin', 'admin', 'login', '2026-09-08 05:24:35'),
(75, 'admin', 'admin', 'logout', '2026-09-08 05:24:47'),
(76, 'rome123', 'ranger', 'login', '2026-09-08 05:24:57'),
(77, 'rome123', 'ranger', 'logout', '2026-09-08 05:26:04'),
(78, 'kaye123', 'menro', 'login', '2026-09-08 05:26:21'),
(79, 'admin', 'admin', 'login', '2026-09-08 05:29:48'),
(80, 'rome123', 'ranger', 'login', '2026-09-08 05:30:23'),
(81, 'rome123', 'ranger', 'logout', '2026-09-08 05:31:16'),
(82, 'admin', 'admin', 'login', '2026-09-08 05:31:37'),
(83, 'admin', 'admin', 'logout', '2026-09-08 05:32:53'),
(84, 'admin', 'admin', 'login', '2026-09-08 05:32:57'),
(85, 'admin', 'admin', 'logout', '2026-09-08 05:33:20'),
(86, 'admin', 'admin', 'login', '2026-09-08 05:33:33'),
(87, 'daniel123', 'menro', 'login', '2026-09-08 05:34:54'),
(88, 'daniel123', 'menro', 'logout', '2026-09-08 05:35:04'),
(89, 'admin', 'admin', 'login', '2026-09-08 05:35:06'),
(90, 'admin', 'admin', 'logout', '2026-09-08 05:37:20'),
(91, 'admin', 'admin', 'login', '2026-09-08 05:37:44'),
(92, 'admin', 'admin', 'logout', '2026-09-08 06:00:35'),
(93, 'daniel123', 'menro', 'login', '2026-09-08 06:21:48'),
(94, 'daniel123', 'menro', 'logout', '2026-09-08 07:04:16'),
(95, 'admin', 'admin', 'login', '2026-09-08 12:53:22'),
(96, 'admin', 'admin', 'logout', '2026-09-08 12:53:27'),
(97, 'admin', 'admin', 'login', '2026-09-08 12:53:41'),
(98, 'admin', 'admin', 'logout', '2026-09-08 13:14:23'),
(99, 'admin', 'admin', 'login', '2026-09-08 13:14:33'),
(101, 'admin', 'admin', 'Deleted Ranger account \"Alessandra06\".', '2026-09-08 13:23:16'),
(102, 'admin', 'admin', 'Deleted Ranger account \"Juan08\".', '2026-09-08 13:28:40'),
(103, 'admin', 'admin', 'Changed Ranger account \"Janelle05\" to MENRO.', '2026-09-08 13:40:44'),
(104, 'admin', 'admin', 'logout', '2026-09-08 13:41:01'),
(105, 'admin', 'admin', 'login', '2026-09-08 13:41:18'),
(106, 'admin', 'admin', 'Dismissed password reset request from \"Janelle05\".', '2026-09-08 13:41:22'),
(107, 'admin', 'admin', 'Deactivated MENRO account \"Janelle05\".', '2026-09-08 13:41:28'),
(108, 'admin', 'admin', 'Changed MENRO account \"Janelle05\" to Ranger.', '2026-09-08 13:41:29'),
(109, 'admin', 'admin', 'Changed MENRO account \"daniel123\" to Ranger.', '2026-09-08 13:42:54'),
(110, 'admin', 'admin', 'logout', '2026-09-08 13:42:55'),
(111, 'daniel123', 'ranger', 'login', '2026-09-08 13:43:07'),
(112, 'daniel123', 'ranger', 'logout', '2026-09-08 13:43:32'),
(113, 'admin', 'admin', 'login', '2026-09-08 13:43:35'),
(114, 'admin', 'admin', 'Changed Ranger account \"daniel123\" to MENRO.', '2026-09-08 13:43:42'),
(115, 'admin', 'admin', 'logout', '2026-09-08 14:34:55'),
(116, 'admin', 'admin', 'login', '2026-09-08 14:35:06'),
(117, 'admin', 'admin', 'Dismissed password reset request from \"rome123\".', '2026-09-08 15:27:42'),
(118, 'admin', 'admin', 'logout', '2026-09-08 15:27:45'),
(119, 'admin', 'admin', 'login', '2026-09-08 15:27:52'),
(120, 'admin', 'admin', 'logout', '2026-09-08 16:13:22'),
(121, 'admin', 'admin', 'login', '2026-09-08 19:11:24'),
(122, 'admin', 'admin', 'logout', '2026-09-08 19:18:10'),
(123, 'admin', 'admin', 'login', '2026-09-09 14:34:56'),
(124, 'admin', 'admin', 'login', '2026-09-09 14:37:41'),
(125, 'admin', 'admin', 'logout', '2026-09-09 14:37:46'),
(126, 'admin', 'admin', 'login', '2026-09-09 14:44:30'),
(127, 'admin', 'admin', 'logout', '2026-09-09 15:32:06'),
(128, 'admin', 'admin', 'login', '2026-09-09 15:32:10'),
(129, 'admin', 'admin', 'logout', '2026-09-09 15:32:29'),
(130, 'daniel123', 'menro', 'login', '2026-09-09 15:32:36'),
(131, 'daniel123', 'menro', 'logout', '2026-09-09 15:32:42'),
(132, 'admin', 'admin', 'login', '2026-09-09 16:04:43'),
(133, 'admin', 'admin', 'login', '2026-09-10 03:18:36'),
(134, 'admin', 'admin', 'logout', '2026-09-10 03:18:39'),
(135, 'daniel123', 'menro', 'login', '2026-09-10 03:18:46'),
(136, 'daniel123', 'menro', 'login', '2026-09-10 16:46:52'),
(137, 'admin', 'admin', 'login', '2026-09-10 16:48:11'),
(138, 'admin', 'admin', 'logout', '2026-09-10 16:48:22'),
(139, 'daniel123', 'menro', 'login', '2026-09-10 16:48:30'),
(140, 'daniel123', 'menro', 'logout', '2026-09-10 19:05:00'),
(141, 'rome123', 'ranger', 'login', '2026-09-11 04:24:25'),
(142, 'rome123', 'ranger', 'logout', '2026-09-11 04:39:43'),
(143, 'kaye123', 'menro', 'login', '2026-09-11 04:39:58'),
(144, 'rome123', 'ranger', 'login', '2026-09-11 04:44:49'),
(145, 'kaye123', 'menro', 'login', '2026-09-11 05:09:28'),
(146, 'rome123', 'ranger', 'login', '2026-09-11 05:12:38'),
(147, 'admin', 'admin', 'login', '2026-09-11 05:28:12'),
(148, 'admin', 'admin', 'logout', '2026-09-11 05:28:18'),
(149, 'kaye123', 'menro', 'login', '2026-09-11 05:28:24'),
(150, 'rome123', 'ranger', 'login', '2026-09-11 06:03:13'),
(151, 'rome123', 'ranger', 'logout', '2026-09-11 06:10:15'),
(152, 'admin', 'admin', 'login', '2026-09-11 06:10:23'),
(153, 'admin', 'admin', 'Changed MENRO account \"kaye123\" to Ranger.', '2026-09-11 06:10:37'),
(154, 'admin', 'admin', 'logout', '2026-09-11 06:10:41'),
(155, 'kaye123', 'ranger', 'login', '2026-09-11 06:10:51'),
(156, 'daniel123', 'menro', 'login', '2026-09-11 06:17:56'),
(157, 'daniel123', 'menro', 'logout', '2026-09-11 06:19:05'),
(158, 'admin', 'admin', 'login', '2026-09-11 06:19:13'),
(159, 'admin', 'admin', 'logout', '2026-09-11 06:19:19'),
(160, 'rome123', 'ranger', 'login', '2026-09-11 06:19:23'),
(161, 'rome123', 'ranger', 'logout', '2026-09-11 06:19:51'),
(162, 'rome123', 'ranger', 'login', '2026-09-11 06:19:54'),
(163, 'admin', 'admin', 'login', '2026-09-11 06:20:25'),
(164, 'admin', 'admin', 'logout', '2026-09-11 06:20:34'),
(165, 'kaye123', 'ranger', 'login', '2026-09-11 06:20:45'),
(166, 'kaye123', 'ranger', 'logout', '2026-09-11 06:20:55'),
(167, 'kaye123', 'ranger', 'login', '2026-09-11 06:20:58'),
(168, 'kaye123', 'ranger', 'logout', '2026-09-11 06:21:14'),
(169, 'rome123', 'ranger', 'login', '2026-09-11 06:21:18'),
(170, 'rome123', 'ranger', 'logout', '2026-09-11 06:21:26'),
(171, 'rome123', 'ranger', 'login', '2026-09-11 06:21:31'),
(172, 'rome123', 'ranger', 'logout', '2026-09-11 06:21:34'),
(173, 'kaye123', 'ranger', 'login', '2026-09-11 06:21:38'),
(174, 'kaye123', 'ranger', 'logout', '2026-09-11 06:21:41'),
(175, 'daniel123', 'menro', 'login', '2026-09-11 06:21:45'),
(176, 'daniel123', 'menro', 'logout', '2026-09-11 06:24:05'),
(177, 'kaye123', 'ranger', 'login', '2026-09-11 06:29:28'),
(178, 'kaye123', 'ranger', 'logout', '2026-09-11 06:30:29'),
(179, 'rome123', 'ranger', 'login', '2026-09-11 06:30:33'),
(180, 'rome123', 'ranger', 'logout', '2026-09-11 06:30:49'),
(181, 'daniel123', 'menro', 'login', '2026-09-11 06:30:53'),
(182, 'daniel123', 'menro', 'logout', '2026-09-11 06:33:59'),
(183, 'kaye123', 'ranger', 'login', '2026-09-11 06:34:03'),
(184, 'kaye123', 'ranger', 'logout', '2026-09-11 06:34:10'),
(185, 'kaye123', 'ranger', 'login', '2026-09-11 06:34:21'),
(186, 'kaye123', 'ranger', 'logout', '2026-09-11 06:34:26'),
(187, 'rome123', 'ranger', 'login', '2026-09-11 06:34:30'),
(188, 'rome123', 'ranger', 'logout', '2026-09-11 06:35:19'),
(189, 'daniel123', 'menro', 'login', '2026-09-11 06:35:24'),
(190, 'daniel123', 'menro', 'logout', '2026-09-11 06:39:28'),
(191, 'daniel123', 'menro', 'login', '2026-09-11 06:42:19'),
(192, 'daniel123', 'menro', 'logout', '2026-09-11 06:45:06'),
(193, 'rome123', 'ranger', 'login', '2026-09-11 06:45:11'),
(194, 'rome123', 'ranger', 'logout', '2026-09-11 06:47:00'),
(195, 'daniel123', 'menro', 'login', '2026-09-11 06:47:03'),
(196, 'daniel123', 'menro', 'logout', '2026-09-11 08:01:58'),
(197, 'kaye123', 'ranger', 'login', '2026-09-11 08:02:03'),
(198, 'kaye123', 'ranger', 'logout', '2026-09-11 08:02:29'),
(199, 'kaye123', 'ranger', 'login', '2026-09-11 08:02:33'),
(200, 'kaye123', 'ranger', 'logout', '2026-09-11 08:02:38'),
(201, 'daniel123', 'menro', 'login', '2026-09-11 08:02:42'),
(202, 'kaye123', 'ranger', 'login', '2026-09-11 08:03:34'),
(203, 'kaye123', 'ranger', 'logout', '2026-09-11 08:04:31'),
(204, 'rome123', 'ranger', 'login', '2026-09-11 08:04:35'),
(205, 'rome123', 'ranger', 'logout', '2026-09-11 08:12:02'),
(206, 'daniel123', 'menro', 'login', '2026-09-11 08:12:07'),
(207, 'daniel123', 'menro', 'logout', '2026-09-11 08:42:22'),
(208, 'admin', 'admin', 'login', '2026-09-11 08:42:26'),
(209, 'admin', 'admin', 'Deleted Ranger account \"Angelo07\".', '2026-09-11 08:42:44'),
(210, 'admin', 'admin', 'Deleted Ranger account \"Edzon01\".', '2026-09-11 08:42:46'),
(211, 'admin', 'admin', 'Deleted Ranger account \"marklee10\".', '2026-09-11 08:42:48'),
(212, 'admin', 'admin', 'Deleted Ranger account \"Janelle05\".', '2026-09-11 08:42:50'),
(213, 'admin', 'admin', 'Deleted Ranger account \"Gilbert02\".', '2026-09-11 08:42:53'),
(214, 'admin', 'admin', 'Deleted Ranger account \"Jhan9\".', '2026-09-11 08:42:55'),
(215, 'admin', 'admin', 'Deleted Ranger account \"Imman09\".', '2026-09-11 08:43:03'),
(216, 'admin', 'admin', 'Deleted Ranger account \"JohnLloyd04\".', '2026-09-11 08:43:09'),
(217, 'admin', 'admin', 'Dismissed password reset request from \"rome123\".', '2026-09-11 08:43:12'),
(218, 'admin', 'admin', 'logout', '2026-09-11 08:43:36'),
(219, 'kaye123', 'ranger', 'login', '2026-09-11 08:43:39'),
(220, 'kaye123', 'ranger', 'logout', '2026-09-11 08:43:48'),
(221, 'daniel123', 'menro', 'login', '2026-09-11 16:37:50'),
(222, 'daniel123', 'menro', 'logout', '2026-09-11 17:06:25'),
(223, 'kaye123', 'ranger', 'login', '2026-09-11 17:06:28'),
(224, 'kaye123', 'ranger', 'logout', '2026-09-11 18:49:11'),
(225, 'kaye123', 'ranger', 'login', '2026-09-12 06:52:10'),
(226, 'admin', 'admin', 'login', '2026-09-12 06:55:53'),
(227, 'admin', 'admin', 'logout', '2026-09-12 06:56:01'),
(228, 'kaye123', 'ranger', 'login', '2026-09-12 06:57:44'),
(229, 'kaye123', 'ranger', 'logout', '2026-09-12 06:58:41'),
(230, 'daniel123', 'menro', 'login', '2026-09-12 06:58:50'),
(231, 'daniel123', 'menro', 'logout', '2026-09-12 06:59:01'),
(232, 'rome123', 'ranger', 'login', '2026-09-12 07:00:23'),
(233, 'rome123', 'ranger', 'logout', '2026-09-12 07:09:48'),
(234, 'admin', 'admin', 'login', '2026-09-12 07:09:56'),
(235, 'admin', 'admin', 'logout', '2026-09-12 07:10:06'),
(236, 'daniel123', 'menro', 'login', '2026-09-12 07:10:36'),
(237, 'kaye123', 'ranger', 'logout', '2026-09-12 07:14:02'),
(238, 'daniel123', 'menro', 'login', '2026-09-12 07:14:06'),
(239, 'daniel123', 'menro', 'logout', '2026-09-12 07:16:54'),
(240, 'daniel123', 'menro', 'logout', '2026-09-12 09:55:58'),
(241, 'kaye123', 'ranger', 'login', '2026-09-12 09:56:02'),
(242, 'kaye123', 'ranger', 'logout', '2026-09-12 10:03:51'),
(243, 'daniel123', 'menro', 'login', '2026-09-12 10:03:56'),
(244, 'daniel123', 'menro', 'logout', '2026-09-12 11:43:22'),
(245, 'rome123', 'ranger', 'login', '2026-09-12 11:43:33'),
(246, 'rome123', 'ranger', 'logout', '2026-09-12 13:55:17'),
(247, 'rome123', 'ranger', 'login', '2026-09-12 13:55:24'),
(248, 'rome123', 'ranger', 'logout', '2026-09-12 13:55:27'),
(249, 'daniel123', 'menro', 'login', '2026-09-12 13:55:30'),
(250, 'daniel123', 'menro', 'logout', '2026-09-12 14:33:22'),
(251, 'daniel123', 'menro', 'login', '2026-09-12 14:33:27'),
(252, 'daniel123', 'menro', 'login', '2026-09-13 07:35:49'),
(253, 'daniel123', 'menro', 'logout', '2026-09-13 07:36:12'),
(254, 'kaye123', 'ranger', 'login', '2026-09-13 07:36:17'),
(255, 'daniel123', 'menro', 'login', '2026-09-13 22:09:05'),
(256, 'daniel123', 'menro', 'login', '2026-09-13 22:29:34'),
(257, 'daniel123', 'menro', 'logout', '2026-09-13 22:36:34'),
(258, 'kaye123', 'ranger', 'login', '2026-09-13 22:36:38'),
(259, 'kaye123', 'ranger', 'logout', '2026-09-13 22:40:55'),
(260, 'kaye123', 'ranger', 'login', '2026-09-13 22:41:00'),
(261, 'kaye123', 'ranger', 'logout', '2026-09-13 22:44:58'),
(262, 'kaye123', 'ranger', 'login', '2026-09-13 22:45:24'),
(263, 'rome123', 'ranger', 'login', '2026-09-13 22:49:11'),
(264, 'daniel123', 'menro', 'login', '2026-09-13 22:50:20'),
(265, 'daniel123', 'menro', 'logout', '2026-09-13 22:51:49'),
(266, 'rome123', 'ranger', 'login', '2026-09-13 22:51:53'),
(267, 'rome123', 'ranger', 'logout', '2026-09-13 23:00:18'),
(268, 'daniel123', 'menro', 'login', '2026-09-14 14:02:35'),
(269, 'daniel123', 'menro', 'logout', '2026-09-14 15:27:38'),
(270, 'daniel123', 'menro', 'login', '2026-09-14 16:12:07'),
(271, 'daniel123', 'menro', 'logout', '2026-09-14 16:13:35'),
(272, 'rome123', 'ranger', 'login', '2026-09-14 16:13:41'),
(273, 'rome123', 'ranger', 'logout', '2026-09-14 16:23:30'),
(274, 'kaye123', 'ranger', 'login', '2026-09-14 16:24:54'),
(275, 'kaye123', 'ranger', 'logout', '2026-09-14 16:34:36'),
(276, 'daniel123', 'menro', 'login', '2026-09-14 16:34:39'),
(277, 'daniel123', 'menro', 'logout', '2026-09-14 16:43:28'),
(278, 'rome123', 'ranger', 'login', '2026-09-14 16:43:33'),
(279, 'rome123', 'ranger', 'logout', '2026-09-14 16:43:38'),
(280, 'kaye123', 'ranger', 'login', '2026-09-14 16:43:41'),
(281, 'kaye123', 'ranger', 'logout', '2026-09-14 17:04:17'),
(282, 'daniel123', 'menro', 'login', '2026-09-14 17:04:21'),
(283, 'rome123', 'ranger', 'login', '2026-09-14 17:07:52'),
(284, 'rome123', 'ranger', 'logout', '2026-09-14 17:07:56'),
(285, 'kaye123', 'ranger', 'login', '2026-09-14 17:08:03'),
(286, 'daniel123', 'menro', 'login', '2026-09-14 17:18:12'),
(287, 'kaye123', 'ranger', 'login', '2026-09-14 17:19:31'),
(288, 'daniel123', 'menro', 'login', '2026-09-14 17:52:04'),
(289, 'kaye123', 'ranger', 'login', '2026-09-14 22:16:19'),
(290, 'daniel123', 'menro', 'login', '2026-09-14 22:21:46'),
(291, 'kaye123', 'ranger', 'login', '2026-09-14 22:28:30'),
(292, 'daniel123', 'menro', 'login', '2026-09-14 22:49:11'),
(293, 'kaye123', 'ranger', 'login', '2026-09-14 23:31:09'),
(294, 'daniel123', 'menro', 'login', '2026-09-15 04:06:14'),
(295, 'kaye123', 'ranger', 'login', '2026-09-15 04:06:19'),
(296, 'kaye123', 'ranger', 'logout', '2026-09-15 04:10:29'),
(297, 'daniel123', 'menro', 'login', '2026-09-15 04:10:33'),
(298, 'daniel123', 'menro', 'logout', '2026-09-15 04:25:16'),
(299, 'kaye123', 'ranger', 'login', '2026-09-15 04:25:20'),
(300, 'admin', 'admin', 'login', '2026-09-15 04:46:07'),
(301, 'daniel123', 'menro', 'login', '2026-09-15 04:46:21'),
(302, 'kaye123', 'ranger', 'login', '2026-09-15 04:58:09'),
(303, 'admin', 'admin', 'login', '2026-09-15 05:10:57'),
(304, 'admin', 'admin', 'logout', '2026-09-15 05:11:02'),
(305, 'daniel123', 'menro', 'login', '2026-09-15 05:11:06'),
(306, 'daniel123', 'menro', 'login', '2026-09-15 05:32:56'),
(307, 'daniel123', 'menro', 'logout', '2026-09-15 05:34:39'),
(308, 'rome123', 'ranger', 'login', '2026-09-15 05:34:44'),
(309, 'rome123', 'ranger', 'logout', '2026-09-15 05:34:47'),
(310, 'kaye123', 'ranger', 'login', '2026-09-15 05:34:53'),
(311, 'admin', 'admin', 'login', '2026-09-15 05:44:26'),
(312, 'admin', 'admin', 'logout', '2026-09-15 05:44:30'),
(313, 'daniel123', 'menro', 'login', '2026-09-15 05:44:35'),
(314, 'kaye123', 'ranger', 'login', '2026-09-15 05:47:12'),
(315, 'daniel123', 'menro', 'login', '2026-09-15 05:47:45'),
(316, 'daniel123', 'menro', 'logout', '2026-09-15 05:58:09'),
(317, 'daniel123', 'menro', 'login', '2026-09-15 05:58:12'),
(318, 'daniel123', 'menro', 'logout', '2026-09-15 05:58:26'),
(319, 'kaye123', 'ranger', 'login', '2026-09-15 05:58:32'),
(320, 'admin', 'admin', 'login', '2026-09-15 05:58:49'),
(321, 'admin', 'admin', 'logout', '2026-09-15 05:58:53'),
(322, 'daniel123', 'menro', 'login', '2026-09-15 05:58:57'),
(323, 'daniel123', 'menro', 'logout', '2026-09-15 06:25:31'),
(324, 'daniel123', 'menro', 'login', '2026-09-15 06:25:39'),
(325, 'daniel123', 'menro', 'logout', '2026-09-15 06:43:42'),
(326, 'daniel123', 'menro', 'login', '2026-09-15 06:45:34'),
(327, 'daniel123', 'menro', 'logout', '2026-09-15 08:52:18'),
(328, 'daniel123', 'menro', 'login', '2026-09-15 08:52:29'),
(329, 'daniel123', 'menro', 'logout', '2026-09-15 09:25:35'),
(330, 'daniel123', 'menro', 'login', '2026-09-15 09:32:28'),
(331, 'daniel123', 'menro', 'logout', '2026-09-15 10:11:20'),
(332, 'daniel123', 'menro', 'login', '2026-09-15 10:11:24'),
(333, 'daniel123', 'menro', 'login', '2026-09-15 23:01:42'),
(334, 'daniel123', 'menro', 'logout', '2026-09-15 23:08:00'),
(335, 'kaye123', 'ranger', 'login', '2026-09-15 23:08:04'),
(336, 'kaye123', 'ranger', 'logout', '2026-09-15 23:22:58'),
(337, 'daniel123', 'menro', 'login', '2026-09-15 23:23:03'),
(338, 'daniel123', 'menro', 'login', '2026-09-17 12:12:09'),
(339, 'rome123', 'ranger', 'login', '2026-09-17 12:38:35'),
(340, 'daniel123', 'menro', 'login', '2026-09-17 12:42:49'),
(341, 'daniel123', 'menro', 'logout', '2026-09-17 12:44:13'),
(342, 'admin', 'admin', 'login', '2026-09-17 12:44:17'),
(343, 'admin', 'admin', 'logout', '2026-09-17 12:44:20'),
(344, 'daniel123', 'menro', 'login', '2026-09-17 12:44:24'),
(345, 'daniel123', 'menro', 'logout', '2026-09-17 12:46:24'),
(346, 'rome123', 'ranger', 'login', '2026-09-17 12:46:28'),
(347, 'rome123', 'ranger', 'logout', '2026-09-17 12:46:47'),
(348, 'daniel123', 'menro', 'login', '2026-09-17 12:46:57'),
(349, 'rome123', 'ranger', 'login', '2026-09-17 12:50:02'),
(350, 'rome123', 'ranger', 'logout', '2026-09-17 12:50:07'),
(351, 'kaye123', 'ranger', 'login', '2026-09-17 12:50:11'),
(352, 'kaye123', 'ranger', 'logout', '2026-09-17 12:50:53'),
(353, 'kaye123', 'ranger', 'login', '2026-09-17 12:50:57'),
(354, 'daniel123', 'menro', 'login', '2026-09-17 12:51:40'),
(355, 'daniel123', 'menro', 'logout', '2026-09-17 13:14:12'),
(356, 'admin', 'admin', 'login', '2026-09-17 13:16:05'),
(357, 'admin', 'admin', 'logout', '2026-09-17 13:16:09'),
(358, 'daniel123', 'menro', 'login', '2026-09-17 13:16:14'),
(359, 'daniel123', 'menro', 'login', '2026-09-18 09:42:29'),
(360, 'daniel123', 'menro', 'logout', '2026-09-18 10:21:55'),
(361, 'daniel123', 'menro', 'login', '2026-09-18 10:24:07'),
(362, 'kaye123', 'ranger', 'login', '2026-09-18 10:49:09'),
(363, 'daniel123', 'menro', 'login', '2026-09-18 10:49:33'),
(364, 'daniel123', 'menro', 'logout', '2026-09-18 11:04:30'),
(365, 'daniel123', 'menro', 'login', '2026-09-18 11:05:05'),
(366, 'daniel123', 'menro', 'logout', '2026-09-18 12:09:27'),
(367, 'daniel123', 'menro', 'login', '2026-09-18 12:51:30'),
(368, 'daniel123', 'menro', 'logout', '2026-09-18 14:04:56'),
(369, 'daniel123', 'menro', 'login', '2026-09-18 14:05:18'),
(370, 'daniel123', 'menro', 'logout', '2026-09-18 14:33:41'),
(371, 'admin', 'admin', 'login', '2026-09-18 14:33:47'),
(372, 'admin', 'admin', 'logout', '2026-09-18 14:34:11'),
(373, 'daniel123', 'menro', 'login', '2026-09-18 14:34:16'),
(374, 'daniel123', 'menro', 'logout', '2026-09-18 15:18:59'),
(375, 'kaye123', 'ranger', 'login', '2026-09-18 15:19:08'),
(376, 'kaye123', 'ranger', 'logout', '2026-09-18 15:53:37'),
(377, 'daniel123', 'menro', 'login', '2026-09-18 15:53:43'),
(378, 'daniel123', 'menro', 'logout', '2026-09-18 15:55:39'),
(379, 'kaye123', 'ranger', 'login', '2026-09-18 15:55:43'),
(380, 'kaye123', 'ranger', 'login', '2026-09-18 15:57:54'),
(381, 'kaye123', 'ranger', 'logout', '2026-09-18 16:16:22'),
(382, 'daniel123', 'menro', 'login', '2026-09-19 03:15:23'),
(383, 'daniel123', 'menro', 'login', '2026-09-19 03:15:36'),
(384, 'daniel123', 'menro', 'login', '2026-09-19 03:16:44'),
(385, 'daniel123', 'menro', 'login', '2026-09-19 03:17:31'),
(386, 'daniel123', 'menro', 'login', '2026-09-19 03:17:48'),
(387, 'daniel123', 'menro', 'logout', '2026-09-19 03:52:26'),
(388, 'daniel123', 'menro', 'login', '2026-09-19 03:52:38'),
(389, 'daniel123', 'menro', 'login', '2026-09-19 13:32:26'),
(390, 'daniel123', 'menro', 'logout', '2026-09-19 13:51:26'),
(391, 'daniel123', 'menro', 'login', '2026-09-19 13:52:08'),
(392, 'daniel123', 'menro', 'logout', '2026-09-19 13:52:13'),
(393, 'kaye123', 'ranger', 'login', '2026-09-19 13:52:17'),
(394, 'kaye123', 'ranger', 'logout', '2026-09-19 13:52:21'),
(395, 'admin', 'admin', 'login', '2026-09-19 13:52:28'),
(396, 'admin', 'admin', 'logout', '2026-09-19 13:52:33'),
(397, 'daniel123', 'menro', 'login', '2026-09-19 13:59:52'),
(398, 'daniel123', 'menro', 'logout', '2026-09-19 14:14:57'),
(399, 'daniel123', 'menro', 'login', '2026-09-20 13:29:34'),
(400, 'daniel123', 'menro', 'logout', '2026-09-20 14:14:42'),
(401, 'rome123', 'ranger', 'login', '2026-09-20 14:14:49'),
(402, 'rome123', 'ranger', 'logout', '2026-09-20 14:15:40'),
(403, 'daniel123', 'menro', 'login', '2026-09-20 14:21:32'),
(404, 'rome123', 'ranger', 'login', '2026-09-20 14:54:50'),
(405, 'rome123', 'ranger', 'logout', '2026-09-20 14:56:56'),
(406, 'daniel123', 'menro', 'login', '2026-09-20 14:57:04'),
(407, 'rome123', 'ranger', 'login', '2026-09-20 15:16:14'),
(408, 'rome123', 'ranger', 'logout', '2026-09-20 15:17:14'),
(409, 'daniel123', 'menro', 'login', '2026-09-20 15:17:21'),
(410, 'daniel123', 'menro', 'logout', '2026-09-20 15:18:16'),
(411, 'rome123', 'ranger', 'login', '2026-09-20 15:18:26'),
(412, 'rome123', 'ranger', 'logout', '2026-09-20 15:21:38'),
(413, 'daniel123', 'menro', 'login', '2026-09-20 15:52:16'),
(414, 'daniel123', 'menro', 'logout', '2026-09-20 15:55:20'),
(415, 'kaye123', 'ranger', 'login', '2026-09-20 15:58:31'),
(416, 'kaye123', 'ranger', 'logout', '2026-09-20 17:00:31'),
(417, 'daniel123', 'menro', 'login', '2026-09-20 17:00:34'),
(418, 'daniel123', 'menro', 'logout', '2026-09-20 17:13:00'),
(419, 'kaye123', 'ranger', 'login', '2026-09-20 17:13:07'),
(420, 'kaye123', 'ranger', 'logout', '2026-09-20 17:14:53'),
(421, 'daniel123', 'menro', 'login', '2026-09-20 17:15:01'),
(422, 'rome123', 'ranger', 'login', '2026-09-20 17:18:10'),
(423, 'kaye123', 'ranger', 'login', '2026-09-20 17:18:19'),
(424, 'kaye123', 'ranger', 'logout', '2026-09-20 17:57:12'),
(425, 'daniel123', 'menro', 'login', '2026-09-20 18:02:12'),
(426, 'kaye123', 'ranger', 'login', '2026-09-20 18:02:27'),
(427, 'daniel123', 'menro', 'login', '2026-09-20 18:03:06'),
(428, 'kaye123', 'ranger', 'login', '2026-09-20 18:05:30'),
(429, 'daniel123', 'menro', 'login', '2026-09-20 18:06:12'),
(430, 'kaye123', 'ranger', 'login', '2026-09-20 18:14:33'),
(431, 'daniel123', 'menro', 'login', '2026-09-20 18:14:46'),
(432, 'daniel123', 'menro', 'login', '2026-09-21 13:19:46'),
(433, 'kaye123', 'ranger', 'login', '2026-09-21 14:04:31'),
(434, 'admin', 'admin', 'login', '2026-09-21 14:07:54'),
(435, 'daniel123', 'menro', 'login', '2026-09-21 14:08:08'),
(436, 'kaye123', 'ranger', 'login', '2026-09-21 14:50:30'),
(437, 'kaye123', 'ranger', 'logout', '2026-09-21 14:54:17'),
(438, 'daniel123', 'menro', 'login', '2026-09-21 14:54:21'),
(439, 'kaye123', 'ranger', 'login', '2026-09-21 15:05:03'),
(440, 'daniel123', 'menro', 'login', '2026-09-21 15:11:02'),
(441, 'daniel123', 'menro', 'logout', '2026-09-21 16:03:55'),
(442, 'daniel123', 'menro', 'login', '2026-09-21 23:14:34'),
(443, 'kaye123', 'ranger', 'login', '2026-09-21 23:23:05'),
(444, 'daniel123', 'menro', 'login', '2026-09-21 23:33:52'),
(445, 'kaye123', 'ranger', 'login', '2026-09-21 23:34:53'),
(446, 'kaye123', 'ranger', 'logout', '2026-09-21 23:36:15'),
(447, 'daniel123', 'menro', 'login', '2026-09-21 23:36:24'),
(448, 'daniel123', 'menro', 'logout', '2026-09-21 23:38:32'),
(449, 'kaye123', 'ranger', 'login', '2026-09-21 23:38:36'),
(450, 'kaye123', 'ranger', 'logout', '2026-09-22 00:14:55'),
(451, 'daniel123', 'menro', 'login', '2026-09-22 12:13:34'),
(452, 'daniel123', 'menro', 'login', '2026-09-22 12:33:58'),
(453, 'daniel123', 'menro', 'login', '2026-09-22 13:00:58'),
(454, 'daniel123', 'menro', 'logout', '2026-09-22 13:37:53'),
(455, 'kaye123', 'ranger', 'login', '2026-09-22 13:38:17'),
(456, 'kaye123', 'ranger', 'logout', '2026-09-22 13:38:44'),
(457, 'daniel123', 'menro', 'login', '2026-09-22 13:43:01'),
(458, 'kaye123', 'ranger', 'login', '2026-09-22 14:15:04'),
(459, 'daniel123', 'menro', 'login', '2026-09-22 14:43:59'),
(460, 'daniel123', 'menro', 'login', '2026-09-22 14:57:37'),
(461, 'kaye123', 'ranger', 'login', '2026-09-22 15:00:14'),
(462, 'kaye123', 'ranger', 'logout', '2026-09-22 15:09:26'),
(463, 'daniel123', 'menro', 'login', '2026-09-22 15:09:33'),
(464, 'daniel123', 'menro', 'logout', '2026-09-22 15:22:03'),
(465, 'kaye123', 'ranger', 'login', '2026-09-22 15:22:06'),
(466, 'kaye123', 'ranger', 'logout', '2026-09-22 15:23:06'),
(467, 'daniel123', 'menro', 'login', '2026-09-22 15:23:09'),
(468, 'daniel123', 'menro', 'logout', '2026-09-22 15:38:38'),
(469, 'kaye123', 'ranger', 'login', '2026-09-22 15:38:42'),
(470, 'kaye123', 'ranger', 'logout', '2026-09-22 15:39:26'),
(471, 'daniel123', 'menro', 'login', '2026-09-22 15:39:36'),
(472, 'daniel123', 'menro', 'logout', '2026-09-22 15:41:55'),
(473, 'daniel123', 'menro', 'login', '2026-09-22 15:53:01'),
(474, 'daniel123', 'menro', 'logout', '2026-09-22 16:48:30'),
(475, 'kaye123', 'ranger', 'login', '2026-09-22 16:48:36'),
(476, 'kaye123', 'ranger', 'logout', '2026-09-22 16:50:08'),
(477, 'daniel123', 'menro', 'login', '2026-09-22 16:51:36'),
(478, 'kaye123', 'ranger', 'login', '2026-09-22 17:08:16'),
(479, 'daniel123', 'menro', 'login', '2026-09-22 17:08:41'),
(480, 'daniel123', 'menro', 'logout', '2026-09-22 17:15:42'),
(481, 'kaye123', 'ranger', 'login', '2026-09-22 17:15:45'),
(482, 'daniel123', 'menro', 'login', '2026-09-22 17:16:42'),
(483, 'kaye123', 'ranger', 'login', '2026-09-22 17:23:22'),
(484, 'kaye123', 'ranger', 'login', '2026-09-22 17:37:10'),
(485, 'admin', 'admin', 'login', '2026-09-22 17:45:12'),
(486, 'admin', 'admin', 'logout', '2026-09-22 17:45:14'),
(487, 'daniel123', 'menro', 'login', '2026-09-22 17:45:21'),
(488, 'rome123', 'ranger', 'login', '2026-09-22 17:45:54'),
(489, 'rome123', 'ranger', 'logout', '2026-09-22 17:46:12'),
(490, 'kaye123', 'ranger', 'login', '2026-09-22 17:46:16'),
(491, 'kaye123', 'ranger', 'logout', '2026-09-22 17:57:18'),
(492, 'kaye123', 'ranger', 'login', '2026-09-22 17:57:44'),
(493, 'daniel123', 'menro', 'login', '2026-09-22 18:11:35'),
(494, 'kaye123', 'ranger', 'login', '2026-09-22 18:12:25'),
(495, 'daniel123', 'menro', 'logout', '2026-09-22 18:14:01'),
(496, 'daniel123', 'menro', 'login', '2026-09-22 18:14:33'),
(497, 'kaye123', 'ranger', 'login', '2026-09-22 18:45:52'),
(498, 'daniel123', 'menro', 'login', '2026-09-22 18:47:02'),
(499, 'daniel123', 'menro', 'logout', '2026-09-22 18:47:54'),
(500, 'daniel123', 'menro', 'login', '2026-09-22 18:48:02'),
(501, 'kaye123', 'ranger', 'login', '2026-09-22 18:52:10'),
(502, 'daniel123', 'menro', 'login', '2026-09-22 18:52:59'),
(503, 'kaye123', 'ranger', 'login', '2026-09-22 18:59:22'),
(504, 'daniel123', 'menro', 'login', '2026-09-22 19:01:24'),
(505, 'kaye123', 'ranger', 'login', '2026-09-22 19:02:21'),
(506, 'kaye123', 'ranger', 'logout', '2026-09-22 19:41:53'),
(507, 'kaye123', 'ranger', 'logout', '2026-09-22 19:41:53'),
(508, 'kaye123', 'ranger', 'login', '2026-09-23 11:58:19'),
(509, 'daniel123', 'menro', 'login', '2026-09-23 12:04:42'),
(510, 'kaye123', 'ranger', 'login', '2026-09-23 12:06:23'),
(511, 'daniel123', 'menro', 'login', '2026-09-23 12:12:38'),
(512, 'kaye123', 'ranger', 'login', '2026-09-23 12:57:24'),
(513, 'daniel123', 'menro', 'login', '2026-09-23 13:04:17'),
(514, 'kaye123', 'ranger', 'login', '2026-09-23 13:08:54'),
(515, 'kaye123', 'ranger', 'logout', '2026-09-23 14:03:50'),
(516, 'kaye123', 'ranger', 'login', '2026-09-23 22:57:50'),
(517, 'kaye123', 'ranger', 'logout', '2026-09-23 23:36:09'),
(518, 'kaye123', 'ranger', 'login', '2026-09-23 23:36:13'),
(519, 'daniel123', 'menro', 'login', '2026-09-23 23:36:22'),
(520, 'kaye123', 'ranger', 'login', '2026-09-23 23:37:50'),
(521, 'kaye123', 'ranger', 'logout', '2026-09-23 23:53:30'),
(522, 'daniel123', 'menro', 'login', '2026-09-23 23:53:36'),
(523, 'daniel123', 'menro', 'login', '2026-09-24 00:10:33'),
(524, 'daniel123', 'menro', 'logout', '2026-09-24 00:20:41'),
(525, 'kaye123', 'ranger', 'login', '2026-09-24 00:35:14'),
(526, 'kaye123', 'ranger', 'logout', '2026-09-24 00:36:20'),
(527, 'kaye123', 'ranger', 'login', '2026-09-25 09:38:33'),
(528, 'kaye123', 'ranger', 'logout', '2026-09-25 09:43:07'),
(529, 'daniel123', 'menro', 'login', '2026-09-25 09:44:53'),
(530, 'daniel123', 'menro', 'logout', '2026-09-25 10:24:44'),
(531, 'rome123', 'ranger', 'login', '2026-09-25 10:24:49'),
(532, 'rome123', 'ranger', 'logout', '2026-09-25 10:25:19'),
(533, 'daniel123', 'menro', 'login', '2026-09-25 10:25:26'),
(534, 'rome123', 'ranger', 'login', '2026-09-25 10:29:06'),
(535, 'daniel123', 'menro', 'login', '2026-09-25 10:52:14'),
(536, 'rome123', 'ranger', 'login', '2026-09-25 10:58:56'),
(537, 'daniel123', 'menro', 'login', '2026-09-25 11:07:24'),
(538, 'rome123', 'ranger', 'login', '2026-09-25 11:11:30'),
(539, 'daniel123', 'menro', 'login', '2026-09-25 11:25:03'),
(540, 'rome123', 'ranger', 'login', '2026-09-25 11:34:38'),
(541, 'daniel123', 'menro', 'login', '2026-09-25 11:44:22'),
(542, 'rome123', 'ranger', 'login', '2026-09-25 11:53:49'),
(543, 'daniel123', 'menro', 'login', '2026-09-25 11:55:36'),
(544, 'rome123', 'ranger', 'login', '2026-09-25 11:56:13'),
(545, 'daniel123', 'menro', 'login', '2026-09-25 12:00:50'),
(546, 'daniel123', 'menro', 'login', '2026-09-25 12:02:40'),
(547, 'daniel123', 'menro', 'logout', '2026-09-25 12:03:30'),
(548, 'kaye123', 'ranger', 'login', '2026-09-25 12:03:39'),
(549, 'daniel123', 'menro', 'login', '2026-09-25 12:06:30'),
(550, 'daniel123', 'menro', 'logout', '2026-09-25 12:43:45'),
(551, 'daniel123', 'menro', 'login', '2026-09-27 12:09:16'),
(552, 'kaye123', 'ranger', 'login', '2026-09-27 12:19:33'),
(553, 'kaye123', 'ranger', 'login', '2026-09-27 12:35:14'),
(554, 'daniel123', 'menro', 'login', '2026-09-27 12:38:35'),
(555, 'daniel123', 'menro', 'login', '2026-09-27 13:11:38'),
(556, 'daniel123', 'menro', 'logout', '2026-09-27 13:14:30'),
(557, 'daniel123', 'menro', 'login', '2026-09-27 13:14:33'),
(558, 'daniel123', 'menro', 'login', '2026-09-27 13:22:38'),
(559, 'daniel123', 'menro', 'logout', '2026-09-27 13:25:06'),
(560, 'kaye123', 'ranger', 'login', '2026-09-27 13:25:12'),
(561, 'admin', 'admin', 'login', '2026-09-27 13:29:05'),
(562, 'admin', 'admin', 'logout', '2026-09-27 13:29:08'),
(563, 'daniel123', 'menro', 'login', '2026-09-27 13:29:12'),
(564, 'kaye123', 'ranger', 'login', '2026-09-27 13:29:52'),
(565, 'kaye123', 'ranger', 'logout', '2026-09-27 13:38:12'),
(566, 'daniel123', 'menro', 'login', '2026-09-27 13:38:18'),
(567, 'daniel123', 'menro', 'logout', '2026-09-27 13:38:22'),
(568, 'daniel123', 'menro', 'login', '2026-09-27 13:38:52'),
(569, 'rome123', 'ranger', 'login', '2026-09-27 13:56:23'),
(570, 'daniel123', 'menro', 'login', '2026-09-27 14:00:50'),
(571, 'daniel123', 'menro', 'login', '2026-09-28 03:40:13'),
(572, 'kaye123', 'ranger', 'login', '2026-09-28 03:41:15'),
(573, 'daniel123', 'menro', 'login', '2026-09-28 03:42:23'),
(574, 'kaye123', 'ranger', 'login', '2026-09-28 03:44:36'),
(575, 'daniel123', 'menro', 'login', '2026-09-28 03:49:56'),
(576, 'kaye123', 'ranger', 'login', '2026-09-28 03:50:42'),
(577, 'daniel123', 'menro', 'login', '2026-09-28 04:03:05'),
(578, 'kaye123', 'ranger', 'login', '2026-09-28 04:03:46'),
(579, 'daniel123', 'menro', 'login', '2026-09-28 04:04:32'),
(580, 'kaye123', 'ranger', 'login', '2026-09-28 04:05:50'),
(581, 'daniel123', 'menro', 'login', '2026-09-28 04:33:09'),
(582, 'kaye123', 'ranger', 'login', '2026-09-28 04:36:36'),
(583, 'kaye123', 'ranger', 'login', '2026-09-28 04:39:24'),
(584, 'daniel123', 'menro', 'login', '2026-09-28 04:53:46'),
(585, 'kaye123', 'ranger', 'login', '2026-09-28 04:56:12'),
(586, 'daniel123', 'menro', 'login', '2026-09-28 04:56:33'),
(587, 'kaye123', 'ranger', 'login', '2026-09-28 05:00:04'),
(588, 'daniel123', 'menro', 'login', '2026-09-28 05:30:41'),
(589, 'daniel123', 'menro', 'logout', '2026-09-28 05:42:52'),
(590, 'kaye123', 'ranger', 'login', '2026-09-28 05:42:59'),
(591, 'kaye123', 'ranger', 'logout', '2026-09-28 05:44:29'),
(592, 'daniel123', 'menro', 'login', '2026-09-28 05:44:57'),
(593, 'kaye123', 'ranger', 'login', '2026-09-28 05:45:54'),
(594, 'daniel123', 'menro', 'login', '2026-09-28 05:53:56'),
(595, 'kaye123', 'ranger', 'login', '2026-09-28 05:55:27'),
(596, 'daniel123', 'menro', 'login', '2026-09-28 05:56:42'),
(597, 'kaye123', 'ranger', 'login', '2026-09-28 05:57:20'),
(598, 'kaye123', 'ranger', 'login', '2026-09-28 15:25:25'),
(599, 'daniel123', 'menro', 'login', '2026-09-28 15:25:53'),
(600, 'kaye123', 'ranger', 'login', '2026-09-28 15:46:47'),
(601, 'daniel123', 'menro', 'login', '2026-09-28 15:46:55'),
(602, 'rome123', 'ranger', 'login', '2026-09-28 15:59:49'),
(603, 'daniel123', 'menro', 'login', '2026-09-28 16:06:06'),
(604, 'rome123', 'ranger', 'login', '2026-09-28 16:12:08'),
(605, 'admin', 'admin', 'login', '2026-09-28 16:14:56'),
(606, 'daniel123', 'menro', 'login', '2026-09-28 16:22:42'),
(607, 'daniel123', 'menro', 'login', '2026-09-28 23:26:57'),
(608, 'rome123', 'ranger', 'login', '2026-09-29 00:16:26'),
(609, 'daniel123', 'menro', 'login', '2026-09-29 00:19:52'),
(610, 'daniel123', 'menro', 'logout', '2026-09-29 00:20:44'),
(611, 'kaye123', 'ranger', 'login', '2026-09-29 00:20:47'),
(612, 'kaye123', 'ranger', 'logout', '2026-09-29 00:22:09'),
(613, 'rome123', 'ranger', 'login', '2026-09-29 00:22:17'),
(614, 'daniel123', 'menro', 'login', '2026-09-29 00:22:32'),
(615, 'rome123', 'ranger', 'login', '2026-09-29 00:23:50'),
(616, 'daniel123', 'menro', 'login', '2026-09-29 00:25:11'),
(617, 'kaye123', 'ranger', 'login', '2026-09-29 00:32:45'),
(618, 'daniel123', 'menro', 'login', '2026-09-29 00:41:22'),
(619, 'rome123', 'ranger', 'login', '2026-09-29 00:48:25'),
(620, 'daniel123', 'menro', 'login', '2026-09-29 00:49:55'),
(621, 'rome123', 'ranger', 'login', '2026-09-29 01:01:01'),
(622, 'rome123', 'ranger', 'logout', '2026-09-29 04:30:19'),
(623, 'kaye123', 'ranger', 'login', '2026-09-29 04:30:25'),
(624, 'kaye123', 'ranger', 'logout', '2026-09-29 04:30:39'),
(625, 'daniel123', 'menro', 'login', '2026-09-29 04:30:48'),
(626, 'daniel123', 'menro', 'logout', '2026-09-29 04:41:35'),
(627, 'kaye123', 'ranger', 'login', '2026-09-29 04:41:39'),
(628, 'kaye123', 'ranger', 'logout', '2026-09-29 05:51:35'),
(629, 'kaye123', 'ranger', 'logout', '2026-09-29 05:51:35'),
(630, 'kaye123', 'ranger', 'login', '2026-09-29 06:48:07'),
(631, 'daniel123', 'menro', 'login', '2026-09-29 07:01:38'),
(632, 'kaye123', 'ranger', 'login', '2026-09-29 07:13:12'),
(633, 'daniel123', 'menro', 'login', '2026-09-29 07:17:18'),
(634, 'kaye123', 'ranger', 'login', '2026-09-29 07:25:44'),
(635, 'daniel123', 'menro', 'login', '2026-09-29 07:34:18'),
(636, 'daniel123', 'menro', 'login', '2026-09-29 12:07:34'),
(637, 'daniel123', 'menro', 'logout', '2026-09-29 12:10:33'),
(638, 'daniel123', 'menro', 'login', '2026-09-29 12:10:39'),
(639, 'kaye123', 'ranger', 'login', '2026-09-29 12:12:10'),
(640, 'kaye123', 'ranger', 'logout', '2026-09-29 12:19:10'),
(641, 'kaye123', 'ranger', 'login', '2026-09-29 12:19:44'),
(642, 'daniel123', 'menro', 'login', '2026-09-29 12:21:53'),
(643, 'kaye123', 'ranger', 'login', '2026-09-29 12:30:24'),
(644, 'kaye123', 'ranger', 'logout', '2026-09-29 12:30:29'),
(645, 'rome123', 'ranger', 'login', '2026-09-29 12:30:34'),
(646, 'daniel123', 'menro', 'login', '2026-09-29 12:52:06'),
(647, 'kaye123', 'ranger', 'login', '2026-09-29 12:53:53'),
(648, 'daniel123', 'menro', 'login', '2026-09-29 13:01:48'),
(649, 'kaye123', 'ranger', 'login', '2026-09-29 13:05:31'),
(650, 'kaye123', 'ranger', 'logout', '2026-09-29 13:07:07'),
(651, 'rome123', 'ranger', 'login', '2026-09-29 13:07:12'),
(652, 'daniel123', 'menro', 'login', '2026-09-29 13:16:39'),
(653, 'daniel123', 'menro', 'logout', '2026-09-29 13:30:45'),
(654, 'daniel123', 'menro', 'login', '2026-09-29 13:30:51'),
(655, 'daniel123', 'menro', 'logout', '2026-09-29 14:37:29'),
(656, 'daniel123', 'menro', 'login', '2026-09-29 15:07:43');

-- --------------------------------------------------------

--
-- Table structure for table `login_lockouts`
--

CREATE TABLE `login_lockouts` (
  `username` varchar(50) NOT NULL,
  `failed_attempts` int(11) NOT NULL DEFAULT 0,
  `lockout_count` int(11) NOT NULL DEFAULT 0,
  `locked_until` timestamp NULL DEFAULT NULL,
  `last_attempt_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `login_lockouts`
--

INSERT INTO `login_lockouts` (`username`, `failed_attempts`, `lockout_count`, `locked_until`, `last_attempt_at`) VALUES
('asd', 0, 1, '2026-09-04 16:30:24', '2026-09-04 16:29:59'),
('dyanne123', 1, 0, NULL, '2026-09-12 07:00:15'),
('kowein@publiq.test', 1, 0, NULL, '2026-09-29 00:16:22'),
('marklee2026!', 3, 0, NULL, '2026-09-06 13:52:46'),
('menro123', 0, 1, '2026-09-04 16:58:35', '2026-09-04 16:58:10'),
('rome67', 2, 0, NULL, '2026-09-08 04:41:44'),
('sad', 0, 0, '2026-09-04 14:36:58', '2026-09-04 14:35:58');

-- --------------------------------------------------------

--
-- Table structure for table `mangrove_extent_shapes`
--

CREATE TABLE `mangrove_extent_shapes` (
  `id` int(11) NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `coordinates` longtext NOT NULL,
  `updated_by` varchar(80) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `menro_accounts`
--

CREATE TABLE `menro_accounts` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `menro_accounts`
--

INSERT INTO `menro_accounts` (`id`, `full_name`, `username`, `password_hash`, `email`, `created_at`, `is_active`) VALUES
(5, 'Rome Dyanne Salvid', 'dyanne67', '$2y$10$x39J1LkYDmHinpfZ54Jkmup66w7LzEdIhHgRf24htAqpSlz/GJMyK', 'romesalvid1257@gmail.com', '2026-09-06 14:40:59', 1),
(8, 'Daniel Magarao', 'daniel123', '$2y$10$gqARRQQjTrdhAzouovICWegJ3W0D010AqzOOXQac7iwukbq5K2KM6', 'danielmagarao002@gmail.com', '2026-09-03 14:21:49', 1);

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_requests`
--

CREATE TABLE `password_reset_requests` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `role` varchar(20) DEFAULT NULL,
  `account_id` int(11) DEFAULT NULL,
  `status` enum('pending','resolved') NOT NULL DEFAULT 'pending',
  `token` varchar(64) DEFAULT NULL,
  `token_expires_at` timestamp NULL DEFAULT NULL,
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `password_reset_requests`
--

INSERT INTO `password_reset_requests` (`id`, `username`, `role`, `account_id`, `status`, `token`, `token_expires_at`, `requested_at`, `resolved_at`) VALUES
(1, 'daniel123', 'menro', 2, 'resolved', 'f4bd6d02cea0f6d5682644ceb00fbe40936106892ff2afc4802d4039a76a1075', '2026-09-04 17:42:14', '2026-09-04 17:09:49', '2026-09-04 17:13:58'),
(2, 'alessandra123', 'menro', 3, 'resolved', NULL, NULL, '2026-09-06 12:37:49', '2026-09-06 12:38:28'),
(3, 'daniel123', 'menro', 2, 'resolved', '46388408aad7de1df9c5abf5553a7fb7d22a82988057d764700764e402ac9523', '2026-09-06 13:48:18', '2026-09-06 13:15:08', '2026-09-06 13:19:02'),
(4, 'marklee2026!', 'menro', 4, 'resolved', '8e3016fdb7dffc31b1da2645de3a38d2a1f1ba07246300ada21981c33d17a214', '2026-09-06 14:23:03', '2026-09-06 13:52:50', '2026-09-06 13:53:11'),
(5, 'rome123', 'ranger', 1, 'resolved', '2354db482f75e733f667e1d70abc81b30c628d9e3e9cd81e98b2db8e7e569476', '2026-09-08 06:01:59', '2026-09-08 05:31:25', '2026-09-08 05:32:49'),
(6, 'daniel123', 'menro', 2, 'resolved', 'a9ff81dc26bd613216c32c4f152a79f331cc15e21fbd9a2ed7dbdb22a72757fb', '2026-09-08 06:03:37', '2026-09-08 05:33:26', '2026-09-08 05:34:09'),
(7, 'Janelle05', 'menro', 7, 'resolved', NULL, NULL, '2026-09-08 13:41:13', '2026-09-08 13:41:22'),
(8, 'rome123', 'ranger', 1, 'resolved', NULL, NULL, '2026-09-08 14:35:01', '2026-09-08 15:27:42'),
(9, 'rome123', 'ranger', 1, 'resolved', NULL, NULL, '2026-09-08 15:27:50', '2026-09-11 08:43:12');

-- --------------------------------------------------------

--
-- Table structure for table `protected_areas`
--

CREATE TABLE `protected_areas` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `barangay` varchar(60) DEFAULT NULL,
  `stated_ha` decimal(6,2) DEFAULT NULL,
  `source` varchar(40) DEFAULT NULL,
  `coordinates` longtext NOT NULL,
  `updated_by` varchar(80) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ranger_accounts`
--

CREATE TABLE `ranger_accounts` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `ranger_accounts`
--

INSERT INTO `ranger_accounts` (`id`, `full_name`, `username`, `password_hash`, `email`, `created_at`, `is_active`) VALUES
(1, 'Rome Dyanne Salvid', 'rome123', '$2y$10$zrTdjoD64M8L.xAC7nnU9OiSfaKIoS3m9x3MMWhrfgGjkbVqvzlPm', 'romesalvid1257@gmail.com', '2026-09-03 14:20:01', 1),
(16, 'Kaye Macalalad', 'kaye123', '$2y$10$9UJPb/7AeD5d5AmBDojDpOLa2Zhv1Ygb.b.Z4PdA/RhVDiLgX/B4m', 'kayemeuliomacalalad@gmail.com', '2026-09-03 14:00:45', 1);

-- --------------------------------------------------------

--
-- Table structure for table `ranger_notifications`
--

CREATE TABLE `ranger_notifications` (
  `id` int(11) NOT NULL,
  `kobo_id` int(11) NOT NULL,
  `ranger_name` varchar(150) NOT NULL,
  `message` varchar(255) NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(20) NOT NULL DEFAULT 'approved',
  `zone_name` varchar(150) DEFAULT NULL,
  `inspection_date` varchar(20) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `ranger_notifications`
--

INSERT INTO `ranger_notifications` (`id`, `kobo_id`, `ranger_name`, `message`, `is_read`, `created_at`, `status`, `zone_name`, `inspection_date`, `notes`) VALUES
(1, -1790099407, 'Kaye Macalalad', 'Your survey for Calatagan Mangrove Area 9 (2026-09-23) has been approved.', 1, '2026-09-25 10:46:10', 'approved', NULL, NULL, NULL),
(2, -1790099407, 'Kaye Macalalad', 'Your survey for Calatagan Mangrove Area 9 (2026-09-23) has been approved.', 1, '2026-09-25 10:53:02', 'approved', NULL, NULL, NULL),
(3, -1790099407, 'Kaye Macalalad', 'Your survey for Calatagan Mangrove Area 9 (2026-09-23) has been approved.', 1, '2026-09-25 10:53:03', 'approved', NULL, NULL, NULL),
(4, -1790099407, 'Kaye Macalalad', 'Your survey for Calatagan Mangrove Area 9 (2026-09-23) has been approved.', 1, '2026-09-25 10:53:04', 'approved', NULL, NULL, NULL),
(5, -1790333484, 'Rome Dyanne Salvid', 'Your survey for Calatagan Mangrove Area 27 (2026-09-25) has been approved.', 1, '2026-09-25 10:53:17', 'approved', NULL, NULL, NULL),
(6, -1790333484, 'Rome Dyanne Salvid', 'Your survey for Calatagan Mangrove Area 27 (2026-09-25) needs revision.', 1, '2026-09-25 10:53:19', 'approved', NULL, NULL, NULL),
(7, -1790333484, 'Rome Dyanne Salvid', 'Your survey for Calatagan Mangrove Area 27 (2026-09-25) has been approved.', 1, '2026-09-25 10:53:19', 'approved', NULL, NULL, NULL),
(8, -1790097347, 'Kaye Macalalad', 'Your survey for Bagong Silang Mangrove Protected Area (2026-09-08) has been approved.', 1, '2026-09-25 10:58:30', 'approved', NULL, NULL, NULL),
(9, -1790097347, 'Kaye Macalalad', 'Your survey for Bagong Silang Mangrove Protected Area (2026-09-08) has been approved.', 1, '2026-09-25 10:58:31', 'approved', NULL, NULL, NULL),
(10, -1789928074, 'Kaye Macalalad', 'Your survey for Calatagan Mangrove Forest Conservation Park \"Ang Pulo\" (2026-09-20) has been approved.', 1, '2026-09-25 10:58:34', 'approved', NULL, NULL, NULL),
(12, -1790098632, 'Kaye Macalalad', 'Your survey for Calatagan Mangrove Area 23 (2026-09-23) needs revision.', 1, '2026-09-25 10:58:39', 'approved', NULL, NULL, NULL),
(13, -1790099407, 'Kaye Macalalad', 'Your survey for Calatagan Mangrove Area 9 (2026-09-23) has been approved.', 1, '2026-09-25 10:58:41', 'approved', NULL, NULL, NULL),
(14, -1790099407, 'Kaye Macalalad', 'Your survey for Calatagan Mangrove Area 9 (2026-09-23) has been approved.', 1, '2026-09-25 10:58:41', 'approved', NULL, NULL, NULL),
(15, -1790332147, 'Rome Dyanne Salvid', 'Your survey for Encarnacion Mangrove Protected Area (2026-09-25) has been approved.', 1, '2026-09-25 10:58:47', 'approved', NULL, NULL, NULL),
(16, -1790333484, 'Rome Dyanne Salvid', 'Your survey for Calatagan Mangrove Area 27 (2026-09-25) needs revision.', 1, '2026-09-25 10:58:48', 'approved', NULL, NULL, NULL),
(17, -1790168246, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-25 11:08:54', 'approved', 'Calatagan Mangrove Area 6', '2026-09-23', NULL),
(19, -1790099407, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-25 11:33:42', 'approved', 'Calatagan Mangrove Area 9', '2026-09-23', NULL),
(20, -1790333484, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-25 11:34:02', 'approved', 'Calatagan Mangrove Area 27', '2026-09-25', NULL),
(21, -1790333484, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-25 11:34:03', 'approved', 'Calatagan Mangrove Area 27', '2026-09-25', NULL),
(22, -1790332147, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-25 11:34:10', 'approved', 'Encarnacion Mangrove Protected Area', '2026-09-25', NULL),
(23, -1790332147, 'Rome Dyanne Salvid', 'Your survey needs revision', 1, '2026-09-25 11:34:17', 'rejected', 'Encarnacion Mangrove Protected Area', '2026-09-25', 'ulitin mo'),
(24, -1790333484, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-25 11:34:27', 'approved', 'Calatagan Mangrove Area 27', '2026-09-25', NULL),
(25, -1790333484, 'Rome Dyanne Salvid', 'Your survey needs revision', 1, '2026-09-25 11:34:28', 'rejected', 'Calatagan Mangrove Area 27', '2026-09-25', NULL),
(26, -1790333484, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-25 11:34:29', 'approved', 'Calatagan Mangrove Area 27', '2026-09-25', NULL),
(27, -1790333484, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-25 11:34:30', 'approved', 'Calatagan Mangrove Area 27', '2026-09-25', NULL),
(28, -1790332147, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-25 12:01:22', 'approved', 'Encarnacion Mangrove Protected Area', '2026-09-25', NULL),
(29, -1790332147, 'Rome Dyanne Salvid', 'Your survey needs revision', 1, '2026-09-25 12:01:25', 'rejected', 'Encarnacion Mangrove Protected Area', '2026-09-25', NULL),
(30, -1790332147, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-25 12:01:26', 'approved', 'Encarnacion Mangrove Protected Area', '2026-09-25', NULL),
(31, -1790098632, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-25 12:06:38', 'approved', 'Calatagan Mangrove Area 23', '2026-09-23', NULL),
(32, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-27 13:24:49', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', 'blablabla'),
(33, -1790515724, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-27 13:29:43', 'approved', 'Calatagan Mangrove Area 3', '2026-09-27', NULL),
(34, -1790512490, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-27 15:04:23', 'approved', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(35, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-27 15:04:25', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(37, -1790512490, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-27 15:09:49', 'approved', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(38, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-27 15:09:52', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(39, -1790512490, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-27 15:16:00', 'approved', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(40, -1790512490, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-27 15:16:02', 'approved', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(41, -1790515724, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-27 15:16:03', 'approved', 'Calatagan Mangrove Area 3', '2026-09-27', NULL),
(43, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-27 15:22:08', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(44, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-27 15:22:11', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(45, -1790512490, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-27 15:22:12', 'approved', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(46, -1790512490, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-27 15:22:27', 'approved', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(47, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-28 03:40:55', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(48, -1790096898, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-28 03:44:24', 'rejected', 'Calatagan Mangrove Area 40', '2026-09-23', NULL),
(49, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-28 03:50:27', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', 'aslkdjlkashflkasjf'),
(50, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-28 04:03:31', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', 'hello world'),
(51, -1790512490, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-28 04:04:51', 'approved', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(52, -1790574739, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-28 05:55:20', 'rejected', 'Bucana\'s Mangroves', '2026-09-28', 'mali yung picture na sinend mo, hindi yan yung mangrove ng bucana'),
(53, -1790574739, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-28 05:57:14', 'approved', 'Bucana\'s Mangroves', '2026-09-28', NULL),
(54, -1790610409, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-28 15:47:16', 'approved', 'Calatagan Mangrove Area 23', '2026-01-14', NULL),
(55, -1790641184, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-29 00:20:07', 'approved', 'Calatagan Mangrove Area 29', '2026-08-01', NULL),
(56, -1790641184, 'Rome Dyanne Salvid', 'Your survey needs revision', 1, '2026-09-29 00:23:42', 'rejected', 'Calatagan Mangrove Area 29', '2026-08-01', NULL),
(57, -1790641184, 'Rome Dyanne Salvid', 'Your survey was approved', 1, '2026-09-29 00:25:41', 'approved', 'Calatagan Mangrove Area 29', '2026-08-01', NULL),
(58, -1790643457, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:08', 'rejected', 'Calatagan Mangrove Area 18', '2026-09-29', NULL),
(59, -1790096898, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:12', 'rejected', 'Calatagan Mangrove Area 40', '2026-09-23', NULL),
(60, -1790574739, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:19', 'rejected', 'Bucana\'s Mangroves', '2026-09-28', NULL),
(61, -1790512490, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:24', 'rejected', 'Calatagan Mangrove Area 39', '2026-09-27', NULL),
(62, -1790515724, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:27', 'rejected', 'Calatagan Mangrove Area 3', '2026-09-27', NULL),
(63, -1790332147, 'Rome Dyanne Salvid', 'Your survey needs revision', 1, '2026-09-29 04:31:30', 'rejected', 'Encarnacion Mangrove Protected Area', '2026-09-25', NULL),
(64, -1790333484, 'Rome Dyanne Salvid', 'Your survey needs revision', 1, '2026-09-29 04:31:32', 'rejected', 'Calatagan Mangrove Area 27', '2026-09-25', NULL),
(65, -1790099407, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:35', 'rejected', 'Calatagan Mangrove Area 9', '2026-09-23', NULL),
(66, -1790098632, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:38', 'rejected', 'Calatagan Mangrove Area 23', '2026-09-23', NULL),
(67, -1790168246, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:40', 'rejected', 'Calatagan Mangrove Area 6', '2026-09-23', NULL),
(68, -1789928074, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:45', 'rejected', 'Calatagan Mangrove Forest Conservation Park \"Ang Pulo\"', '2026-09-20', NULL),
(69, -1790097347, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:47', 'rejected', 'Bagong Silang Mangrove Protected Area', '2026-09-08', NULL),
(70, -1790641184, 'Rome Dyanne Salvid', 'Your survey needs revision', 1, '2026-09-29 04:31:50', 'rejected', 'Calatagan Mangrove Area 29', '2026-08-01', NULL),
(71, -1790610409, 'Kaye Macalalad', 'Your survey needs revision', 1, '2026-09-29 04:31:52', 'rejected', 'Calatagan Mangrove Area 23', '2026-01-14', NULL),
(72, -1790643457, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-29 12:08:46', 'approved', 'Calatagan Mangrove Area 18', '2026-09-29', NULL),
(73, -1790686869, 'Kaye Macalalad', 'Your survey was approved', 1, '2026-09-29 13:05:20', 'approved', 'Calatagan Mangrove Rehabilitation and Nursery Project', '2026-09-29', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `ranger_submissions`
--

CREATE TABLE `ranger_submissions` (
  `kobo_id` int(11) NOT NULL,
  `uuid` varchar(64) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `inspection_date` date DEFAULT NULL,
  `raw_json` longtext NOT NULL,
  `synced_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `locally_edited` tinyint(1) NOT NULL DEFAULT 0,
  `edited_at` timestamp NULL DEFAULT NULL,
  `approval_status` varchar(20) NOT NULL DEFAULT 'pending',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewed_by` varchar(100) DEFAULT NULL,
  `review_notes` text DEFAULT NULL,
  `alert_reviewed` tinyint(1) NOT NULL DEFAULT 0,
  `alert_reviewed_at` timestamp NULL DEFAULT NULL,
  `alert_reviewed_by` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `ranger_submissions`
--

INSERT INTO `ranger_submissions` (`kobo_id`, `uuid`, `barangay`, `inspection_date`, `raw_json`, `synced_at`, `locally_edited`, `edited_at`, `approval_status`, `reviewed_at`, `reviewed_by`, `review_notes`, `alert_reviewed`, `alert_reviewed_at`, `alert_reviewed_by`) VALUES
(-1790687533, 'e574737d18c851350b7028afa8411bdb', 'Carretunan', '2026-01-21', '{\"Ranger_Name\":\"Rome Dyanne Salvid\",\"Inspection_Date\":\"2026-01-21\",\"Record_your_current_location\":\"13.920471407124 120.62097799959 0 0\",\"Estimated_Canopy_Cover_\":\"80\",\"Overall_Health_Assessment\":\"moderate\",\"Observed_Threats\":\"pests,sand_gravel_extraction\",\"Observed_Threats_Other\":\"\",\"Additional_Notes\":\"\",\"Water_Clarity\":\"very_murky\",\"Water_Color\":\"brown\",\"Odor\":\"fishy\",\"Visible_Foam_or_Discharge\":\"none\",\"Nearby_Aquafarm_Activity\":\"no\",\"Aquafarm_Name\":\"\",\"Aquafarm_Location_Lat\":\"\",\"Aquafarm_Location_Lng\":\"\",\"Aquafarm_Distance_m\":\"\",\"Discharge_Toward_Mangroves\":\"\",\"Salinity_ppt\":\"20\",\"PH\":\"4\",\"Water_Temperature_C\":\"35\",\"Secchi_Depth_cm\":\"12\",\"Water_Quality_Notes\":\"\",\"Species_Records\":[{\"Species_Name\":\"Buboi-gubat (Ceiba pentandra)\",\"Tree_Count\":\"14\",\"Sapling_Count\":\"9\",\"Seedling_Count\":\"4\"},{\"Species_Name\":\"Dapo\",\"Tree_Count\":\"6\",\"Sapling_Count\":\"7\",\"Seedling_Count\":\"8\"},{\"Species_Name\":\"Bakawan babae (Rhizophora mucronata)\",\"Tree_Count\":\"3\",\"Sapling_Count\":\"13\",\"Seedling_Count\":\"23\"}],\"Mollusk_Records\":[],\"Photo_Documentation\":\"http:\\/\\/localhost\\/GIS\\/Menro\\/data\\/uploads\\/photo_d07bdda41af6e275.jpg\",\"_zone_id\":\"field-41\",\"_zone_name\":\"Calatagan Mangrove Area 9\",\"_zone_barangay\":\"Carretunan\",\"_id\":-1790687533,\"_uuid\":\"e574737d18c851350b7028afa8411bdb\",\"_submission_time\":\"2026-09-29T15:12:13+02:00\",\"_status\":\"submitted_natively\"}', '2026-09-29 13:12:13', 0, NULL, 'pending', NULL, NULL, NULL, 0, NULL, NULL),
(-1790686869, 'a036b0fbc71df2ee5f83e764df0bb0fe', 'Balibago', '2026-09-29', '{\"Ranger_Name\":\"Kaye Macalalad\",\"Inspection_Date\":\"2026-09-29\",\"Record_your_current_location\":\"13.924820143573 120.62466817895 0 0\",\"Estimated_Canopy_Cover_\":\"42\",\"Overall_Health_Assessment\":\"healthy\",\"Observed_Threats\":\"none_observed\",\"Observed_Threats_Other\":\"\",\"Additional_Notes\":\"\",\"Water_Clarity\":\"clear\",\"Water_Color\":\"no_color\",\"Odor\":\"none\",\"Visible_Foam_or_Discharge\":\"none\",\"Nearby_Aquafarm_Activity\":\"yes\",\"Aquafarm_Name\":\"SVJD Aquafarm\",\"Aquafarm_Location_Lat\":\"14.063190573625073\",\"Aquafarm_Location_Lng\":\"120.71986346185689\",\"Aquafarm_Distance_m\":\"12\",\"Discharge_Toward_Mangroves\":\"no_visible_discharge\",\"Salinity_ppt\":\"35\",\"PH\":\"2\",\"Water_Temperature_C\":\"22\",\"Secchi_Depth_cm\":\"16\",\"Water_Quality_Notes\":\"\",\"Species_Records\":[{\"Species_Name\":\"Bakawan lalaki (Rhizophora apiculata)\",\"Tree_Count\":\"20\",\"Sapling_Count\":\"5\",\"Seedling_Count\":\"7\"},{\"Species_Name\":\"Caballero (Caesalpinia pulcherrima)\",\"Tree_Count\":\"11\",\"Sapling_Count\":\"8\",\"Seedling_Count\":\"12\"},{\"Species_Name\":\"Buli (Corypha elata)\",\"Tree_Count\":\"9\",\"Sapling_Count\":\"\",\"Seedling_Count\":\"5\"},{\"Species_Name\":\"Kalapinay (Avicennia marina)\",\"Tree_Count\":\"4\",\"Sapling_Count\":\"6\",\"Seedling_Count\":\"\"}],\"Mollusk_Records\":[{\"Mollusk_Species_Name\":\"Sihi \\/ Halaan (Lajonkairia lajonkairii)\",\"Mollusk_Count\":\"1\"},{\"Mollusk_Species_Name\":\"Lokan \\/ Mud clam (Polymesoda erosa)\",\"Mollusk_Count\":\"1\"},{\"Mollusk_Species_Name\":\"Tulya \\/ Asian clam (Corbicula fluminea)\",\"Mollusk_Count\":\"1\"}],\"Photo_Documentation\":\"http:\\/\\/localhost\\/GIS\\/Menro\\/data\\/uploads\\/photo_25ab91d6b1748407.jpg\",\"_zone_id\":\"field-32\",\"_zone_name\":\"Calatagan Mangrove Rehabilitation and Nursery Project\",\"_zone_barangay\":\"Balibago\",\"_id\":-1790686869,\"_uuid\":\"a036b0fbc71df2ee5f83e764df0bb0fe\",\"_submission_time\":\"2026-09-29T15:01:09+02:00\",\"_status\":\"submitted_natively\"}', '2026-09-29 13:05:20', 0, NULL, 'approved', '2026-09-29 13:05:20', 'Daniel Magarao', NULL, 0, NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_accounts`
--
ALTER TABLE `admin_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `login_lockouts`
--
ALTER TABLE `login_lockouts`
  ADD PRIMARY KEY (`username`);

--
-- Indexes for table `mangrove_extent_shapes`
--
ALTER TABLE `mangrove_extent_shapes`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `menro_accounts`
--
ALTER TABLE `menro_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `password_reset_requests`
--
ALTER TABLE `password_reset_requests`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `protected_areas`
--
ALTER TABLE `protected_areas`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ranger_accounts`
--
ALTER TABLE `ranger_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `ranger_notifications`
--
ALTER TABLE `ranger_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ranger_name` (`ranger_name`);

--
-- Indexes for table `ranger_submissions`
--
ALTER TABLE `ranger_submissions`
  ADD PRIMARY KEY (`kobo_id`),
  ADD KEY `idx_barangay` (`barangay`),
  ADD KEY `idx_inspection_date` (`inspection_date`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin_accounts`
--
ALTER TABLE `admin_accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=657;

--
-- AUTO_INCREMENT for table `mangrove_extent_shapes`
--
ALTER TABLE `mangrove_extent_shapes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=130;

--
-- AUTO_INCREMENT for table `menro_accounts`
--
ALTER TABLE `menro_accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `password_reset_requests`
--
ALTER TABLE `password_reset_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `protected_areas`
--
ALTER TABLE `protected_areas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `ranger_accounts`
--
ALTER TABLE `ranger_accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `ranger_notifications`
--
ALTER TABLE `ranger_notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=74;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

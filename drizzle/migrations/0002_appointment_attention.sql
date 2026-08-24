ALTER TABLE `appointments`
  ADD COLUMN `confirmationDelayMinutes` int NULL AFTER `confirmationStatus`,
  ADD COLUMN `confirmationAttention` enum('none','pending','accepted','resolved','reschedule') NOT NULL DEFAULT 'none' AFTER `confirmationDelayMinutes`;

ALTER TABLE `message_queue`
  ADD COLUMN `retry_of_queue_id` int NULL;

ALTER TABLE `message_queue`
  ADD KEY `message_queue_retry_of_idx` (`retry_of_queue_id`);

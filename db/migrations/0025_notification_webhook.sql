-- =====================================================================
-- 0025_notification_webhook.sql
--
-- Power Automate gets a second connection for notifications to the team
-- (such as a session filling up), next to the email webhook (31 Oct
-- 2026). Settings › Connections groups both under Power Automate. Nothing
-- calls the notification webhook yet.
-- =====================================================================

UPDATE portal.connections SET label = 'Email webhook' WHERE key = 'email_webhook';

INSERT INTO portal.connections (key, label) VALUES ('notification_webhook', 'Notification webhook');

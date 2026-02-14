-- Reset all user passwords to "change me" (bcryptjs, cost 10).
-- Required because the hashing strategy changed from Rails Devise to bcryptjs
-- and existing password hashes are incompatible with the new login.
UPDATE `users` SET `encrypted_password` = '$2b$10$znzVhLa0fWR8YDoBGjbMwu70nB.yZ7gUKawrbQAUZ5vgNhjlrNRyK';

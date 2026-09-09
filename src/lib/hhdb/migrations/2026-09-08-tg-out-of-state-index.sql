-- Covering index for the Transactions > Exploration out-of-state charts
-- (HhdbDashboardCollection.getOutOfState*). Those queries filter on
-- conveyanceAmount > 0 (~300k of 3.7M rows) and then group by recDate /
-- mailingState / mailingZipCode, so leading on conveyanceAmount turns a
-- 2.3 GB full-table scan (minutes when the buffer pool is cold) into a
-- range scan that is answered entirely from the index.
-- Online DDL: reads and writes proceed while it builds (~1 min).
ALTER TABLE tg_transactions
  ADD INDEX idx_tg_out_of_state (conveyanceAmount, recDate, mailingState, mailingZipCode, mailingCity),
  ALGORITHM=INPLACE, LOCK=NONE;

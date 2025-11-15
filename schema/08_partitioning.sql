-- Default partitions to ensure writes succeed before rolling maintenance jobs add time-based partitions.

CREATE TABLE IF NOT EXISTS ad_impressions_default
    PARTITION OF ad_impressions DEFAULT;

CREATE TABLE IF NOT EXISTS driver_location_events_default
    PARTITION OF driver_location_events DEFAULT;

CREATE TABLE IF NOT EXISTS shipment_events_default
    PARTITION OF shipment_events DEFAULT;

CREATE TABLE IF NOT EXISTS webhook_events_default
    PARTITION OF webhook_events DEFAULT;




-- Suggested helper: create_monthly_partitions('ad_impressions', 'occurred_at', '2024-01-01');
-- Implement partition management logic in background jobs or external automation.


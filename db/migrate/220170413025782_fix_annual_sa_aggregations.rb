class FixAnnualSaAggregations < ActiveRecord::Migration[6.0]
  def self.up
    updated_series_ids = []
    updates_log = []

    say "Starting Annual SA Aggregation Fix Migration"

    # Find all annual series with aggregate data sources
    annual_series = Series.where("name LIKE '%.A'")
    total_annual = annual_series.count
    say "Found #{total_annual} annual series to evaluate"

    # STEP 1: Refresh all dependencies first (in case they're stale)
    say "Step 1: Refreshing dependencies for all annual series..."
    annual_series.find_each do |series|
      series.data_sources.each do |ds|
        ds.set_dependencies!
      end
    end
    say "✓ Dependencies refreshed"

    # STEP 2: Find and fix SA -> NS issues
    say "Step 2: Finding series that load from SA when NS exists..."
    annual_series.find_each do |series|
      series.data_sources.each do |ds|

        next if ds.dependencies.blank?

        # Only process if there's exactly ONE dependency (single series aggregation)
        next unless ds.dependencies.size == 1

        dep_name = ds.dependencies.first
        dep_series = Series.find_by(name: dep_name)
        next unless dep_series

        # Only process if dependency is seasonally adjusted
        next unless dep_series.seasonal_adjustment == 'seasonally_adjusted'

        # Construct NS version name (simple: insert NS before @)
        if dep_name =~ /^(.+?)(@.+)$/
          ns_name = "#{$1}NS#{$2}"
          ns_series = Series.find_by(name: ns_name)

          # Only update if NS version exists and is properly marked
          if ns_series && ns_series.seasonal_adjustment == 'not_seasonally_adjusted'
            old_eval = ds.eval
            new_eval = old_eval.gsub(dep_name, ns_name)

            if old_eval != new_eval
              ds.update!(eval: new_eval)
              ds.set_dependencies!

              updated_series_ids << series.id unless updated_series_ids.include?(series.id)

              log_msg = "  ✓ #{series.name} (DS #{ds.id}): #{dep_name} -> #{ns_name}"
              say log_msg
              Rails.logger.info { "FixAnnualSaAggregations: #{log_msg}" }
              updates_log << log_msg
            end
          end
        end
      end
    end

    say "\n=== SUMMARY ==="
    say "Total annual series evaluated: #{total_annual}"
    say "DataSources updated: #{updates_log.size}"
    say "Unique series affected: #{updated_series_ids.size}"

    # Batch reload all updated series
    if updated_series_ids.any?
      say "\nStarting batch reload of #{updated_series_ids.size} series..."
      Rails.logger.info { "FixAnnualSaAggregations: Starting batch reload" }
      begin
        Series.reload_with_dependencies(updated_series_ids, 'sa_fix_migration', nightly: false)
        say "✓ Batch reload completed successfully"
        Rails.logger.info { "FixAnnualSaAggregations: Batch reload completed successfully" }
      rescue => e
        say "✗ Batch reload failed: #{e.message}", true
        Rails.logger.error { "FixAnnualSaAggregations: Batch reload failed: #{e.message}" }
        # Don't raise - we still want the eval updates to persist
      end
    else
      say "No series needed updating"
    end

    say "Migration complete"
  end

  def self.down
    # This migration updates data, not schema - no automatic rollback
    say "No automatic rollback available for data migration", true
  end
end

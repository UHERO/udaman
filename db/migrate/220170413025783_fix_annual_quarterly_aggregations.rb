class FixAnnualQuarterlyAggregations < ActiveRecord::Migration[6.0]
  def self.up
    updated_series_ids = []
    updates_log = []

    say "Starting Annual Quarterly->Monthly Aggregation Fix Migration"

    # Find all annual series
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

    # STEP 2: Find and fix Q -> M opportunities
    say "Step 2: Finding annual series that aggregate from Q when M exists..."
    annual_series.find_each do |series|
      series.data_sources.each do |ds|
        next if ds.dependencies.blank?

        # Only process if there's exactly ONE dependency (single series aggregation)
        next unless ds.dependencies.size == 1

        dep_name = ds.dependencies.first

        # Only process if dependency is quarterly
        next unless dep_name =~ /\.Q$/

        # Construct monthly version name (replace .Q with .M)
        monthly_name = dep_name.sub(/\.Q$/, '.M')
        monthly_series = Series.find_by(name: monthly_name)

        # Only update if monthly version exists
        if monthly_series
          old_eval = ds.eval
          new_eval = old_eval.gsub(dep_name, monthly_name)

          if old_eval != new_eval
            ds.update!(eval: new_eval)
            ds.set_dependencies!

            updated_series_ids << series.id unless updated_series_ids.include?(series.id)

            log_msg = "  ✓ #{series.name} (DS #{ds.id}): #{dep_name} -> #{monthly_name}"
            say log_msg
            Rails.logger.info { "FixAnnualQuarterlyAggregations: #{log_msg}" }
            updates_log << log_msg
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
      Rails.logger.info { "FixAnnualQuarterlyAggregations: Starting batch reload" }
      begin
        Series.reload_with_dependencies(updated_series_ids, 'q_to_m_migration', nightly: false)
        say "✓ Batch reload completed successfully"
        Rails.logger.info { "FixAnnualQuarterlyAggregations: Batch reload completed successfully" }
      rescue => e
        say "✗ Batch reload failed: #{e.message}", true
        Rails.logger.error { "FixAnnualQuarterlyAggregations: Batch reload failed: #{e.message}" }
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

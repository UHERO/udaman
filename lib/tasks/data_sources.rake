namespace :data_sources do
  desc "Update VSO data sources from CSV files"
  task update_vso: :environment do
    # Function to process each VSO file
    def process_vso_file(filename)
      input_path = "/data/rparsed/#{filename}"
      puts "Processing #{input_path}..."

      headers = File.open(input_path, &:readline)
        .split(',')
        .map(&:strip)
        .reject { |h| h.downcase == "time" }
        .map { |s| s.split('@') }

      processed_count = 0
      headers.each do |h|
        name = h[0]
        geography = h[1]
        series_name = "#{name} @#{geography}"

        s = Series.search(series_name).first
        if s.nil?
          puts "  - Skipping #{series_name} (not found)"
          next
        end

        # Find and disable old data sources related to hawaiitourismauth
        old_sources = s.data_sources.select { |ds| ds.eval.include?("hawaiitourismauth") }
        old_sources.each do |ds|
          puts "  - Disabling old data source: #{ds.id}"
          ds.disable!
        end

        # Create new data source with proper attributes
        # Note: Use 'rparsed/...' rather than '/data/rparsed/...' since the load_from method
        # will internally prepend ENV['DATA_PATH'] to this relative path
        loader_attrs = {
          eval: "(\"#{s.name}\".tsn.load_from \"rparsed/#{filename}\")",
          priority: "100",
          scale: "0.001",
          clear_before_load: "0",
          pseudo_history: false
        }

        # Let the DataSource model handle color assignment
        data_source = DataSource.new(loader_attrs.merge(series_id: s.id))
        data_source.setup

        # Use create_from_form to properly create and save the data source
        if data_source.create_from_form
          puts "  - Created new data source for #{s.name}"
          processed_count += 1
        else
          puts "  - Error creating data source for #{s.name}"
        end
      end
      puts "Processed #{processed_count} series from #{input_path}"
    end

    # Process each VSO file
    process_vso_file("vso_1.csv")
    process_vso_file("vso_2.csv")
    process_vso_file("vso_3.csv")

    puts "VSO data source update completed successfully!"
  end

  desc "Change Source from ID 72 to ID 21 for series with data sources containing 'All Isl Monthly Stats model.xlsx'"
  task update_monthly_stats_sources: :environment do
    puts "Starting Source update for series with 'All Isl Monthly Stats model.xlsx'..."

    # Verify target Source exists
    target_source = Source.find_by(id: 21)
    if target_source.nil?
      puts "ERROR: Target Source with ID 21 not found. Aborting."
      exit 1
    end

    original_source = Source.find_by(id: 72)
    if original_source.nil?
      puts "WARNING: Original Source with ID 72 not found."
    end

    puts "Target Source: ID 21 (#{target_source.description})"
    puts "Original Source: ID #{original_source&.id || 'NOT FOUND'} (#{original_source&.description || 'UNKNOWN'})"
    puts ""

    # Find all series that have data sources with eval containing the target string
    series_with_matching_eval = Series.joins(:data_sources)
                                     .where("data_sources.eval LIKE ?", "%All Isl Monthly Stats model.xlsx%")
                                     .distinct

    puts "Found #{series_with_matching_eval.count} series with data sources containing 'All Isl Monthly Stats model.xlsx'"
    puts ""

    updated_count = 0

    series_with_matching_eval.each do |series|
      old_source_id = series.source_id
      old_source_name = series.source&.description || "UNKNOWN"

      # Update the source_id for this series using scratch flag to bypass validation
      series.update_columns(scratch: 11011)
      series.update!(source_id: 21)
      series.update_columns(scratch: 0)

      puts "Updated Series: #{series.name} (ID: #{series.id})"
      puts "  Source changed: #{old_source_name} (#{old_source_id}) -> #{target_source.description} (21)"
      updated_count += 1
      puts ""
    end

    puts "Successfully updated #{updated_count} series"
    puts "All series with data sources containing 'All Isl Monthly Stats model.xlsx' now use Source ID 21 (#{target_source.description})"
  end

  desc "Update frequency_transform to 'sum' for series matching specific search terms"
  task update_frequency_transform_to_sum: :environment do
    puts "Starting frequency_transform update for specified search terms..."

    # List of search terms to look for
    search_terms = [
      "^KN",
      "^KP",
      "^KR",
      "^NT",
      "^PC(?=(DM|IT))",
      "^TD",
      "^TG",
      "^TR(?!MS)",
      "^UI",
      "^VA(?!DC)",
      "^VDAY",
      "^VEXP(?!P)",
      "^VIS",
      "^VP",
      "^VS",
      "^VX(?!P)"
    ]

    puts "Search terms: #{search_terms.join(', ')}"
    puts ""

    total_updated = 0

    search_terms.each do |term|
      puts "Searching for term: '#{term}'"

      # Use the built-in Series.search method
      matching_series = Series.search(term, limit: 10000)

      puts "  Found #{matching_series.count} series matching '#{term}'"

      term_updated = 0

      matching_series.each do |series|
        # Check if the series has an xseries record and current frequency_transform
        xseries = series.xseries
        if xseries.nil?
          puts "  WARNING: Series #{series.name} (ID: #{series.id}) has no xseries record - skipping"
          next
        end

        current_transform = xseries.frequency_transform

        # Only update if it's not already 'sum'
        if current_transform != 'sum'
          # Use scratch flag to bypass validation during update
          series.update_columns(scratch: 11011)
          xseries.update!(frequency_transform: 'sum')
          series.update_columns(scratch: 0)
          puts "  Updated: #{series.name} (ID: #{series.id}) - #{current_transform.inspect} -> 'sum'"
          term_updated += 1
        else
          puts "  Skipped: #{series.name} (ID: #{series.id}) - already 'sum'"
        end
      end

      puts "  Updated #{term_updated} series for term '#{term}'"
      total_updated += term_updated
      puts ""
    end

    puts "Task completed!"
    puts "Total series updated: #{total_updated}"
    puts "All matching series now have frequency_transform set to 'sum'"
  end

  desc "Rollback frequency_transform changes using output from changes.txt"
  task rollback_frequency_transform_to_sum: :environment do
    puts "Starting frequency_transform rollback from changes.txt..."

    changes_file = File.join(Rails.root, 'lib', 'tasks', 'changes.txt')

    unless File.exist?(changes_file)
      puts "ERROR: changes.txt file not found at #{changes_file}"
      exit 1
    end

    puts "Reading changes from: #{changes_file}"
    puts ""

    rollback_count = 0
    error_count = 0

    File.readlines(changes_file).each do |line|
      # Look for lines like: "  Updated: SERIES_NAME@GEO.FREQ (ID: 12345) - old_value -> 'sum'"
      if line.strip =~ /Updated:\s+(.+?)\s+\(ID:\s+(\d+)\)\s+-\s+(.+?)\s+->\s+'sum'/
        series_name = $1
        series_id = $2.to_i
        old_value = $3

        # Parse the old value - it could be nil, "average", etc.
        original_value = case old_value
                        when 'nil'
                          nil
                        when /^"(.+)"$/
                          $1  # Remove quotes from strings like "average"
                        else
                          old_value
                        end

        begin
          # Find the series and its xseries
          series = Series.find(series_id)
          xseries = series.xseries

          if xseries.nil?
            puts "ERROR: Series #{series_name} (ID: #{series_id}) has no xseries record"
            error_count += 1
            next
          end

          # Check current value
          current_value = xseries.frequency_transform
          if current_value != 'sum'
            puts "SKIP: #{series_name} (ID: #{series_id}) - current value '#{current_value}' is not 'sum'"
            next
          end

          # Rollback to original value
          series.update_columns(scratch: 11011)
          xseries.update!(frequency_transform: original_value)
          series.update_columns(scratch: 0)

          puts "Rolled back: #{series_name} (ID: #{series_id}) - 'sum' -> #{original_value.inspect}"
          rollback_count += 1

        rescue ActiveRecord::RecordNotFound
          puts "ERROR: Series with ID #{series_id} not found"
          error_count += 1
        rescue => e
          puts "ERROR: Failed to rollback series #{series_name} (ID: #{series_id}): #{e.message}"
          error_count += 1
        end
      end
    end

    puts ""
    puts "Rollback completed!"
    puts "Successfully rolled back: #{rollback_count} series"
    puts "Errors encountered: #{error_count}"
    puts "All series have been restored to their original frequency_transform values"
  end
end

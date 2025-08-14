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
      
      # Update the source_id for this series
      series.update!(source_id: 21)
      
      puts "Updated Series: #{series.name} (ID: #{series.id})"
      puts "  Source changed: #{old_source_name} (#{old_source_id}) -> #{target_source.description} (21)"
      updated_count += 1
      puts ""
    end
    
    puts "Successfully updated #{updated_count} series"
    puts "All series with data sources containing 'All Isl Monthly Stats model.xlsx' now use Source ID 21 (#{target_source.description})"
  end
end

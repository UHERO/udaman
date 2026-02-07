class AddRparsedDataSourcesForVlosNrAndUnemp < ActiveRecord::Migration[6.0]
  def up
    # Series to add rparsed DataSources for, grouped by file
    series_by_file = {
      'nr_bea_intq.csv' => %w[
        NR@HAW.Q
        NR@HON.Q
        NR@KAU.Q
        NR@MAU.Q
      ],
      'sa_jobs.csv' => %w[
        UNEMP@HI.M
      ],
      'sa_tour.csv' => %w[
        VLOS@HAW.M
        VLOS@HI.M
        VLOS@HON.M
        VLOS@KAU.M
        VLOS@MAU.M
        VLOSCAN@HAW.M
        VLOSCAN@HI.M
        VLOSCAN@HON.M
        VLOSCAN@KAU.M
        VLOSCAN@MAU.M
        VLOSDM@HAW.M
        VLOSDM@HI.M
        VLOSDM@HON.M
        VLOSDM@KAU.M
        VLOSDM@MAU.M
        VLOSIT@HAW.M
        VLOSIT@HI.M
        VLOSIT@HON.M
        VLOSIT@KAU.M
        VLOSIT@MAU.M
        VLOSJP@HAW.M
        VLOSJP@HI.M
        VLOSJP@HON.M
        VLOSJP@KAU.M
        VLOSJP@MAU.M
        VLOSOT@HI.M
        VLOSRES@HAW.M
        VLOSRES@HI.M
        VLOSRES@HON.M
        VLOSRES@KAU.M
        VLOSRES@MAU.M
        VLOSUS@HAW.M
        VLOSUS@HI.M
        VLOSUS@HON.M
        VLOSUS@KAU.M
        VLOSUS@MAU.M
        VLOSUSE@HAW.M
        VLOSUSE@HI.M
        VLOSUSE@HON.M
        VLOSUSE@KAU.M
        VLOSUSE@MAU.M
        VLOSUSW@HAW.M
        VLOSUSW@HI.M
        VLOSUSW@HON.M
        VLOSUSW@KAU.M
        VLOSUSW@MAU.M
      ]
    }

    created = []
    skipped = []
    not_found = []

    series_by_file.each do |filename, series_names|
      series_names.each do |series_name|
        series = Series.find_by(name: series_name)

        if series.nil?
          not_found << series_name
          next
        end

        eval_stmt = "\"#{series_name}\".tsn.load_from \"rparsed/#{filename}\""

        # Check if this exact DataSource already exists
        existing = DataSource.find_by(series_id: series.id, eval: eval_stmt)
        if existing
          skipped << { name: series_name, reason: 'already exists' }
          next
        end

        # Determine priority based on existing DataSources
        # - API sources are higher priority than rparsed (rparsed gets higher number)
        # - Download sources are lower priority than rparsed (rparsed gets lower number)
        existing_ds = DataSource.where(series_id: series.id, disabled: false)
        has_api = existing_ds.any? { |ds| ds.eval =~ /load_api/ }
        has_download = existing_ds.any? { |ds| ds.eval =~ /load_from_download/ }
        existing_priorities = existing_ds.pluck(:priority).compact

        priority = if has_api
                     # rparsed is lower priority than api
                     (existing_priorities.max || 0) + 1
                   elsif has_download
                     # rparsed is higher priority than download
                     [(existing_priorities.min || 1) - 1, 0].max
                   else
                     0
                   end

        DataSource.create!(
          series_id: series.id,
          eval: eval_stmt,
          universe: series.universe,
          priority: priority,
          reload_nightly: true
        )

        created << {
          name: series_name,
          file: filename,
          priority: priority,
          has_api: has_api,
          has_download: has_download
        }
      end
    end

    # Print summary
    puts "\n" + "=" * 70
    puts "MIGRATION COMPLETE: AddRparsedDataSourcesForVlosNrAndUnemp"
    puts "=" * 70

    puts "\nCREATED (#{created.count}):"
    created.each_with_index do |r, i|
      puts "  #{i + 1}. #{r[:name]} -> rparsed/#{r[:file]} (priority: #{r[:priority]})"
    end

    if skipped.any?
      puts "\nSKIPPED (#{skipped.count}):"
      skipped.each { |r| puts "  - #{r[:name]}: #{r[:reason]}" }
    end

    if not_found.any?
      puts "\nNOT FOUND (#{not_found.count}):"
      not_found.each { |name| puts "  - #{name}" }
    end

    puts "\n" + "=" * 70
  end

  def down
    series_by_file = {
      'nr_bea_intq.csv' => %w[NR@HAW.Q NR@HON.Q NR@KAU.Q NR@MAU.Q],
      'sa_jobs.csv' => %w[UNEMP@HI.M],
      'sa_tour.csv' => %w[
        VLOS@HAW.M VLOS@HI.M VLOS@HON.M VLOS@KAU.M VLOS@MAU.M
        VLOSCAN@HAW.M VLOSCAN@HI.M VLOSCAN@HON.M VLOSCAN@KAU.M VLOSCAN@MAU.M
        VLOSDM@HAW.M VLOSDM@HI.M VLOSDM@HON.M VLOSDM@KAU.M VLOSDM@MAU.M
        VLOSIT@HAW.M VLOSIT@HI.M VLOSIT@HON.M VLOSIT@KAU.M VLOSIT@MAU.M
        VLOSJP@HAW.M VLOSJP@HI.M VLOSJP@HON.M VLOSJP@KAU.M VLOSJP@MAU.M
        VLOSOT@HI.M
        VLOSRES@HAW.M VLOSRES@HI.M VLOSRES@HON.M VLOSRES@KAU.M VLOSRES@MAU.M
        VLOSUS@HAW.M VLOSUS@HI.M VLOSUS@HON.M VLOSUS@KAU.M VLOSUS@MAU.M
        VLOSUSE@HAW.M VLOSUSE@HI.M VLOSUSE@HON.M VLOSUSE@KAU.M VLOSUSE@MAU.M
        VLOSUSW@HAW.M VLOSUSW@HI.M VLOSUSW@HON.M VLOSUSW@KAU.M VLOSUSW@MAU.M
      ]
    }

    deleted = []

    series_by_file.each do |filename, series_names|
      series_names.each do |series_name|
        series = Series.find_by(name: series_name)
        next unless series

        eval_stmt = "\"#{series_name}\".tsn.load_from \"rparsed/#{filename}\""
        ds = DataSource.find_by(series_id: series.id, eval: eval_stmt)

        if ds
          ds.destroy
          deleted << series_name
        end
      end
    end

    puts "\nROLLBACK: Deleted #{deleted.count} DataSources"
    deleted.each { |name| puts "  - #{name}" }
  end
end

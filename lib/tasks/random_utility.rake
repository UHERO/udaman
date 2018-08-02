## JIRA: UA-989
task :batch_add_source_for_aggregated => :environment do
  agg_series = Series.get_all_uhero.joins(:data_sources).where(%q{eval like '%aggregate%'}).uniq
  eval_match = %r/^"(\S+?)@(\w+?)\.([ASQMWD])".ts.aggregate\(:\w+,:\w+\)$/i  ## series name regex from Series.parse_name()

  agg_series.each do |s|
    name_parts = series.parse_name
    sources = s.data_sources
    sources.each do |ds|
      next unless ds.eval.gsub(/\s/,'') =~ eval_match ## match with all whitespace removed
      prefix = $1
      frequency = $3
      next unless prefix.upcase == name_parts[:prefix].upcase
      if frequency.freqn < name_parts[:freq].freqn
        raise "strange aggregation, lower to higher, data source id=#{ds.id}"
      end

    end


    series = ds.series

    best = ds
    series_dses = series.data_sources - [ds]
    series_dses.each do |r|
      next unless r.eval.gsub(/\s/,'') =~ eval_match
      rprefix = $1
      rfreq = $3
      next unless rprefix.upcase == name_parts[:prefix].upcase
      if frequency.freqn < name_parts[:freq].freqn
        raise "strange aggregation, lower to higher, data source id=#{ds.id}"
      end
      if rfreq.fn >
      end
    end
  end
end

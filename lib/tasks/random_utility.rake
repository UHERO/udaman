## JIRA: UA-989
task :batch_add_source_for_aggregated => :environment do
  agg_series = Series.get_all_uhero.joins(:data_sources).where(%q{eval like '%aggregate%'}).uniq
  eval_match = %r/^"((\S+?)@(\w+?)\.([ASQMWD]))".ts.aggregate\(:\w+,:\w+\)$/i  ## series name regex from Series.parse_name()

  agg_series.each do |s|
    name_parts = series.parse_name
    best = nil
    best_freq = 0
    s.data_sources.each do |ds|
      next unless ds.eval.gsub(/\s/,'') =~ eval_match ## match with all whitespace removed
      name = $1
      prefix = $2
      frequency = $4
      next unless prefix.upcase == name_parts[:prefix].upcase
      if frequency.freqn < name_parts[:freq].freqn
        raise "strange aggregation, lower to higher, data source id=#{ds.id}"
      end
      if best.nil? || frequency.freqn > best_freq.freqn
        best = name
        best_freq = frequency
      end
    end
    best = best.ts
    s.update_attributes(
      unit_id: best.unit_id,
      source_id: best.source_id,
      source_detail_id: best.source_detail_id,
      source_link: best.source_link)
  end
end

## JIRA: UA-989
task :batch_add_source_for_aggregated => :environment do
  agg_sources = DataSource.get_all_uhero.where(%q{eval like '%aggregate%'})
  agg_sources.each do |ds|
    eval_match = %r/^"(\S+?)@(\w+?)\.([ASQMWD])".ts.aggregate\(:\w+,:\w+\)$/i  ## series name regex from Series.parse_name()
    next unless ds.eval.gsub(/\s/,'') =~ eval_match ## match with all whitespace removed
    prefix = $1
    frequency = $3
    series = ds.series
    name_parts = series.parse_name
    next unless prefix.upcase == name_parts[:prefix].upcase
    if frequency.freqn < name_parts[:freq].freqn
      raise "strange aggregation, ds id=#{ds.id}"
    end
  end
end

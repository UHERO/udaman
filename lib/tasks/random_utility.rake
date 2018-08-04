## JIRA: UA-989
task :batch_add_source_for_aggregated => :environment do
  agg_series = Series.get_all_uhero.joins(:data_sources).where(%q{eval like '%aggregate%'}).uniq
  eval_match = %r/^(["'])((\S+?)@(\w+?)\.([ASQMWD]))\1\.ts\.aggregate\(:\w+,:\w+\)$/i  ## series name regex from Series.parse_name()

  agg_series.each do |s|
    name_parts = s.parse_name
    best = nil
    best_freq = -1
    s.data_sources.each do |ds|
      next unless ds.eval.gsub(/\s/,'') =~ eval_match ## match with all whitespace removed
      name = $2
      prefix = $3
      frequency = $5
      next unless prefix.upcase == name_parts[:prefix].upcase
      if frequency.freqn < name_parts[:freq].freqn
        raise "strange aggregation, lower to higher, data source id=#{ds.id}"
      end
      if best.nil? || frequency.freqn > best_freq
        best = name
        best_freq = frequency.freqn
      end
    end
    parent = best.ts
    unless parent
      raise "no series found with name=#{best}"
    end
    print "Series #{s.name}(#{s.id}): "
    if s.unit_id && s.unit_id != parent.unit_id
      print "U "
    end
    if s.source_id && s.source_id != parent.source_id
      print "S "
    end
    if s.source_detail_id && s.source_detail_id != parent.source_detail_id
      print "D "
    end
    if !s.source_link.blank? && s.source_link != parent.source_link
      print "L "
    end
    puts ""
    next
    s.update_attributes(
      unit_id: parent.unit_id,
      source_id: parent.source_id,
      source_detail_id: parent.source_detail_id,
      source_link: parent.source_link)
  end
end

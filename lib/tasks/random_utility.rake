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
    next unless best
    parent = best.ts
    unless parent
      raise "no series found with name=#{best}"
    end
    all_defined = s.unit_id && s.source_id && s.source_detail_id && s.source_link
    print "Series #{s.name}(#{s.id}): "
    # if derived series already fully matches parent, skip
    if all_defined &&
        s.unit_id == parent.unit_id &&
        s.source_id == parent.source_id &&
        s.source_detail_id == parent.source_detail_id &&
        s.source_link == parent.source_link
      puts 'already match'
      next
    end
    # if derived series has none of these fields set, update them
    unless parent.unit_id || parent.source_id || parent.source_detail_id || parent.source_link
      puts "parent #{parent.name}(#{parent.id}) got nuthin - skipping"
      next
    end
    # if derived series has none of these fields set, update them
    unless s.unit_id || s.source_id || s.source_detail_id || s.source_link
      s.update!(
          unit_id: parent.unit_id,
          source_id: parent.source_id,
          source_detail_id: parent.source_detail_id,
          source_link: parent.source_link
      )
      puts "none set, updated from #{parent.name}(#{parent.id})"
      next
    end
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
    s.update!(
      unit_id: parent.unit_id,
      source_id: parent.source_id,
      source_detail_id: parent.source_detail_id,
      source_link: parent.source_link)
  end
end

## JIRA: UA-993
task :create_coh_cpi_measurements => :environment do
  meas = Measurement.where(prefix: %w{CPI INFCORE INF_SH PCFB PCHS PCHSSH PCHSSHRT PCHSSHOW PCHSFU PCHSFUGSE PCHSHF
                                      PCTR PCTRMF PCMD PCRE PCED PCOT PC_FDEN PC_EN PC_MD PC_SH PCSV_MD PCSV_RN})
  meas.each do |m|
    print ">>>>> Starting measurement #{m.prefix}"
    new = m.dup
    new.update(prefix: new.prefix + '_COH')
    if new.prefix =~ /^PC/
      new.update(data_portal_name: new.data_portal_name.sub('CPI','Honolulu CPI'))
    end
    new.save!
    puts "...... #{new.prefix} SAVED"
    m.series.each do |s|
      if s.geography.handle == 'HON'
        new_name = s.name.sub('@HON','@HAW')
        s = Series.get(new_name) || s.dup_series_for_geo('HAW')
      end
      new.series << s
    end
  end
end

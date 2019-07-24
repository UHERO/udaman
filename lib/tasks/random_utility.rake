## JIRA: UA-989
task :batch_update_meta_for_aggregated => :environment do
  agg_series = Series.get_all_uhero.joins(:data_sources).where(%q{eval like '%aggregate%' and scratch <> 1111}).uniq
  eval_match = %r/^(["'])((\S+?)@(\w+?)\.([ASQMWD]))\1\.ts\.aggregate\(:\w+,:\w+\)$/i  ## series name regex from Series.parse_name()
  marked_series = []
  cmds = {}

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
      puts '>>>> already match'
      next
    end
    # if derived series has none of these fields set, update them
    parent_any_defined = parent.unit_id || parent.source_id || parent.source_detail_id || parent.source_link
    unless parent_any_defined
      puts ">>>> parent #{parent.name}(#{parent.id}) got nuthin - skipping"
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
      puts ">>>> none set, updated from #{parent.name}(#{parent.id})"
      next
    end
    puts "hand edit..."
    parent_unit = (parent.unit && parent.unit.long_label) || '(empty)'
    parent_source = (parent.source && parent.source.description) || '(empty)'
    parent_detail = (parent.source_detail && parent.source_detail.description) || '(empty)'
    parent_link = parent.source_link.blank? ? '(empty)' : parent.source_link
    loop do
      s_unit = (s.unit && s.unit.long_label) || '(empty)'
      s_source = (s.source && s.source.description) || '(empty)'
      s_detail = (s.source_detail && s.source_detail.description) || '(empty)'
      s_link = s.source_link.blank? ? '(empty)' : s.source_link
      format = sprintf('%%-22s: u=%%-%ds    s=%%-%ds    d=%%-%ds    l=%%-%ds',
                       [s_unit.length, parent_unit.length].max,
                       [s_source.length, parent_source.length].max,
                       [s_detail.length, parent_detail.length].max,
                       [s_link.length, parent_link.length].max
               )
      puts sprintf(format, parent.name, parent_unit, parent_source, parent_detail, parent_link)
      puts sprintf(format, s.name, s_unit, s_source, s_detail, s_link)
      print '> '
      cmds = STDIN.gets.chomp.split(//).map{|x| [x, true] }.to_h
      s.update!(scratch: 1111) if cmds['n']
      break if cmds['n'] || cmds['Q']
      if cmds['m']
        marked_series.push(s)
        puts "####### Series #{s.name} marked"
        next
      end
      if cmds['U']
        res_id = choose_resource(Unit, 'to_s')
        s.update!(unit_id: res_id) if res_id
        next
      end
      if cmds['S']
        res_id = choose_resource(Source, 'description')
        s.update!(source_id: res_id) if res_id
        next
      end
      if cmds['D']
        res_id = choose_resource(SourceDetail, 'description')
        s.update!(source_detail_id: res_id) if res_id
        next
      end
      updates = {}
      updates.merge!(unit_id: parent.unit_id)                   if cmds['u'] || cmds['A']
      updates.merge!(source_id: parent.source_id)               if cmds['s'] || cmds['A']
      updates.merge!(source_detail_id: parent.source_detail_id) if cmds['d'] || cmds['A']
      updates.merge!(source_link: parent.source_link)           if cmds['l'] || cmds['A']
      s.update!(updates) unless updates.empty?
      s.reload
    end
    break if cmds['Q']
  end
  puts "Marked series:"
  marked_series.sort.uniq.each {|s| puts "#{s.name} - https://udaman.uhero.hawaii.edu/series/#{s.id}" }
end

def choose_resource(klass, method)
  all_rows = klass.where(universe: 'UHERO')
  i = 1
  id_map = {}
  all_rows.each do |res|
    label = res.send(method)
    puts sprintf('%02d. %s', i, label)
    id = res.read_attribute(:id)
    id_map[i] = id
    i = i + 1
  end
  print 'choice> '
  choice = STDIN.gets.chomp.to_i
  id_map[choice]  ## returns nil for index 0
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

## JIRA UA-994
task :ua_994 => :environment do
  all_s = Series.joins(:geography).where(
      %q{(name like 'EMPL@%' or name like 'EMPLNS@%' or name like 'LF@%' or name like 'LFNS@%' or name like 'UR@%' or name like 'URNS@%')
          and geographies.handle in ('MOL','MAUI','LAN')}
  )
  all_s.sort_by {|s| s.name }.each do |s|
    print "Doing #{s.name}..."
    kau_s = s.find_sibling_for_geo('KAU')
    unless kau_s
      puts ">>>>>> No KAU sibling series found for #{s.name}"
      next
    end
    s.update_attributes!(
         dataPortalName: kau_s.dataPortalName,
         unit_id: kau_s.unit_id,
         source_id: kau_s.source_id,
         source_detail_id: kau_s.source_detail_id,
         source_link: 'https://www.hiwi.org/'
    )
    puts "done."
  end
end

## JIRA UA-1160
task :ua_1160 => :environment do
  old = %w[CAINC4 CAINC5N CAINC6N SARPI MARPI SARPP MARPP SAIRPD MAIRPD SAINC4 SAINC5N SAINC6N SQINC4 SQINC5 SQINC5N SQINC6N]
  new = %w[CA4 CA5N CA6N RPI1 RPI2 RPP1 RPP2 IRPD1 IRPD2 SA4 SA5N SA6N SQ4 SQ5 SQ5N SQ6N]

  sids = DataSource.get_all_uhero.where(%q{eval like '%load_from_bea%'}).map {|ds| ds.series.id }.uniq
  sids.each do |s|
    bea_defs = Series.find(s).data_sources.select {|d| d.eval =~ /load_from_bea.*Regional/ }
    next if bea_defs.count < 2
    bea_defs.each do |reg|
      if reg.eval =~ /load_from_bea\s*\((.*?)\)/            ## extract load_from_bea parameters only
        (freq, dataset, opts) = Kernel::eval ('[%s]' % $1)  ## reconstitute into an array - Ruby rox
      end
    end
  end
end
